package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class ValidationService {
    @Autowired private ApprovedInsurerRepository approvedInsurerRepository;
    @Autowired private InsurancePolicyRepository insurancePolicyRepository;
    @Autowired private CollateralRepository collateralRepository;
    @Autowired private LoanAccountRepository loanAccountRepository;
    @Autowired private LoanCollateralLinkRepository loanCollateralLinkRepository;
    @Autowired private OwnershipDocumentRepository ownershipDocumentRepository;
    @Autowired private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;
    @Autowired private CollateralTaxonomyRepository collateralTaxonomyRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private ConfigurationService configurationService;

    public void validatePolicy(InsurancePolicy policy) {
        validateBasicPolicy(policy);
    }

    public void validatePolicyForActivation(InsurancePolicy policy) {
        validateBasicPolicy(policy);
        if (policy.getCollateralId() == null || policy.getCollateralId().isBlank()) {
            throw new IllegalArgumentException("A collateral must be linked before policy activation.");
        }
        Collateral collateral = collateralRepository.findById(policy.getCollateralId())
            .or(() -> collateralRepository.findByCode(policy.getCollateralId()))
            .orElseThrow(() -> new IllegalArgumentException("Linked collateral was not found: " + policy.getCollateralId()));

        if (policy.getCustomerId() != null && !policy.getCustomerId().isBlank()) {
            boolean custExists = customerRepository.findById(policy.getCustomerId()).isPresent() ||
                    customerRepository.findFirstByCifIgnoreCase(policy.getCustomerId()).isPresent() ||
                    (collateral.getCustomerId() != null && (
                        collateral.getCustomerId().equalsIgnoreCase(policy.getCustomerId()) ||
                        customerRepository.findById(collateral.getCustomerId()).isPresent() ||
                        customerRepository.findFirstByCifIgnoreCase(collateral.getCustomerId()).isPresent()
                    ));
            if (!custExists) {
                throw new IllegalArgumentException("Customer does not exist: " + policy.getCustomerId());
            }
        }

        if (configurationService.isApprovedInsurerRequired()) {
            if (policy.getInsurerName() == null || policy.getInsurerName().isBlank()) {
                throw new IllegalArgumentException("Approved insurer is mandatory.");
            }
            String pIns = policy.getInsurerName().trim().toLowerCase();
            boolean approved = approvedInsurerRepository.findByNameIgnoreCase(policy.getInsurerName().trim())
                .map(ApprovedInsurer::isActive)
                .orElseGet(() -> approvedInsurerRepository.findAll().stream().anyMatch(i ->
                    i.isActive() && (
                        i.getName().equalsIgnoreCase(policy.getInsurerName().trim()) ||
                        pIns.contains(i.getName().toLowerCase().replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim()) ||
                        i.getName().toLowerCase().contains(pIns.replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim())
                    )
                ));
            if (!approved) {
                throw new IllegalArgumentException("Insurer '" + policy.getInsurerName() + "' is not an active approved insurer.");
            }
        }

        validateDuplicatePolicy(policy);
        validateCoverage(policy, collateral);
        validatePolicyTerm(policy, collateral);

        if (configurationService.areMandatoryDocumentRulesEnabled()) {
            validateMandatoryDocuments(collateral);
        }
    }

    public void validateCollateralForActivation(Collateral collateral) {
        if (collateral == null) throw new IllegalArgumentException("Collateral is required.");
        if (collateral.getValuationAmount() <= 0) throw new IllegalArgumentException("Collateral valuation amount must be greater than zero.");
        if (collateral.getCode() == null || collateral.getCode().isBlank()) throw new IllegalArgumentException("Collateral code is mandatory.");
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) throw new IllegalArgumentException("Collateral category is mandatory.");
        if (collateral.getCurrency() == null || collateral.getCurrency().isBlank()) throw new IllegalArgumentException("Collateral currency is mandatory.");
        validateTaxonomy(collateral);
        validateDuplicateCollateral(collateral);
        if (configurationService.areMandatoryDocumentRulesEnabled()) validateMandatoryDocuments(collateral);
    }

    public void validateCustomerIsolation(String customerId, List<String> facilityIds, String collateralId) {
        if (customerId == null || customerId.isBlank()) {
            throw new IllegalArgumentException("Customer identification is required.");
        }

        if (collateralId != null && !collateralId.isBlank()) {
            Collateral col = collateralRepository.findById(collateralId)
                    .or(() -> collateralRepository.findByCode(collateralId)).orElse(null);
            if (col != null && col.getCustomerId() != null && !col.getCustomerId().isBlank()) {
                if (!col.getCustomerId().equalsIgnoreCase(customerId)) {
                    throw new IllegalArgumentException("Customer Isolation Violation: Collateral belongs to customer " 
                            + col.getCustomerId() + ", not " + customerId);
                }
            }
        }

        if (facilityIds != null) {
            for (String facId : facilityIds) {
                if (facId == null || facId.isBlank()) continue;
                LoanAccount fac = loanAccountRepository.findById(facId)
                        .or(() -> loanAccountRepository.findByLoanReference(facId)).orElse(null);
                if (fac != null && fac.getCustomerId() != null && !fac.getCustomerId().isBlank()) {
                    if (!fac.getCustomerId().equalsIgnoreCase(customerId)) {
                        throw new IllegalArgumentException("Customer Isolation Violation: Facility " + fac.getLoanReference() 
                                + " belongs to customer " + fac.getCustomerId() + ", not " + customerId);
                    }
                }
            }
        }
    }

    public void validateAllocationOverflow(double netCollateralValue, List<Double> allocations) {
        double total = 0;
        for (Double alloc : allocations) {
            if (alloc == null || alloc <= 0) {
                throw new IllegalArgumentException("Allocation amount must be greater than zero.");
            }
            total += alloc;
        }
        if (total > netCollateralValue + 1e-6) {
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                    "Total allocated security (ETB %,.2f) exceeds net collateral value (ETB %,.2f).", total, netCollateralValue));
        }
    }

    public void validateCollateralRelease(String collateralId) {
        Collateral col = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        for (LoanCollateralLink link : links) {
            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId != null) {
                LoanAccount fac = loanAccountRepository.findById(facId)
                        .or(() -> loanAccountRepository.findByLoanReference(facId)).orElse(null);
                if (fac != null && fac.getOutstandingBalance() > 0) {
                    throw new IllegalArgumentException(String.format(Locale.ROOT,
                            "Cannot release collateral: Secured facility %s has an active outstanding balance of ETB %,.2f.",
                            fac.getLoanReference(), fac.getOutstandingBalance()));
                }
            }
        }
    }

    private void validateDuplicateCollateral(Collateral collateral) {
        List<Collateral> existing = collateralRepository.findAll();
        for (Collateral c : existing) {
            if (collateral.getId() != null && collateral.getId().equalsIgnoreCase(c.getId())) continue;
            if (collateral.getCode() != null && collateral.getCode().equalsIgnoreCase(c.getCode())) {
                throw new IllegalArgumentException("Duplicate collateral code: " + collateral.getCode());
            }
            if (collateral.getTitleDeedNumber() != null && !collateral.getTitleDeedNumber().isBlank()
                    && collateral.getTitleDeedNumber().equalsIgnoreCase(c.getTitleDeedNumber())) {
                throw new IllegalArgumentException("Collateral with Title Deed Number '" + collateral.getTitleDeedNumber() + "' already exists.");
            }
            if (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank()
                    && collateral.getRegistrationNumber().equalsIgnoreCase(c.getRegistrationNumber())) {
                throw new IllegalArgumentException("Collateral with Registration/VIN Number '" + collateral.getRegistrationNumber() + "' already exists.");
            }
        }
    }

    private void validateBasicPolicy(InsurancePolicy policy) {
        if (policy == null) throw new IllegalArgumentException("Insurance policy is required.");
        if (policy.getPolicyNumber() == null || policy.getPolicyNumber().isBlank()) throw new IllegalArgumentException("Policy number is mandatory.");
        if (policy.getInsuredAmount() <= 0) throw new IllegalArgumentException("Insured amount must be greater than zero.");
        if (policy.getPremium() <= 0) throw new IllegalArgumentException("Policy premium must be greater than zero.");
        if (policy.getEffectiveDate() == null || policy.getEffectiveDate().isBlank() || policy.getExpiryDate() == null || policy.getExpiryDate().isBlank()) {
            throw new IllegalArgumentException("Effective date and expiry date are mandatory.");
        }
        LocalDate eff=parseDate(policy.getEffectiveDate(),"effective date");
        LocalDate exp=parseDate(policy.getExpiryDate(),"expiry date");
        if (!exp.isAfter(eff)) throw new IllegalArgumentException("Policy expiry date must be after the effective date.");
        if (exp.isBefore(LocalDate.now())) throw new IllegalArgumentException("Expired policies cannot be registered/activated.");
    }

    private void validateDuplicatePolicy(InsurancePolicy policy) {
        List<InsurancePolicy> existing = insurancePolicyRepository.findAll();
        for (InsurancePolicy p : existing) {
            if (policy.getId() != null && policy.getId().equals(p.getId())) continue;
            if (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(p.getPolicyNumber())) {
                throw new IllegalArgumentException("Duplicate insurance policy number: " + policy.getPolicyNumber());
            }
            // If this is a renewal or replacement of policy 'p', skip duplicate check with p
            if (policy.getRenewedFromPolicyId() != null && (policy.getRenewedFromPolicyId().equals(p.getId()) || policy.getRenewedFromPolicyId().equalsIgnoreCase(p.getPolicyNumber()))) {
                continue;
            }
            if (policy.getReplacesPolicyId() != null && (policy.getReplacesPolicyId().equals(p.getId()) || policy.getReplacesPolicyId().equalsIgnoreCase(p.getPolicyNumber()))) {
                continue;
            }
            // Ignore policies that are cancelled, closed, rejected, renewed, or replaced
            if ("Cancelled".equalsIgnoreCase(p.getStatus()) || "Closed".equalsIgnoreCase(p.getStatus()) ||
                "Rejected".equalsIgnoreCase(p.getStatus()) || "Renewed".equalsIgnoreCase(p.getStatus()) ||
                "Replaced".equalsIgnoreCase(p.getStatus())) {
                continue;
            }
            if (same(policy.getCustomerId(), p.getCustomerId()) && same(policy.getCollateralId(), p.getCollateralId()) && same(policy.getInsurerName(), p.getInsurerName())) {
                throw new IllegalArgumentException("A policy already exists for this customer, collateral and insurer.");
            }
        }
    }

    private void validateCoverage(InsurancePolicy policy, Collateral collateral) {
        double exposure = 0;
        for (LoanCollateralLink link : loanCollateralLinkRepository.findAll()) {
            if (!same(link.getCollateralId(), collateral.getId()) && !same(link.getCollateralId(), collateral.getCode())) continue;
            String fId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (fId != null) {
                Optional<LoanAccount> loan = loanAccountRepository.findById(fId)
                        .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(fId))
                        .or(() -> loanAccountRepository.findFirstByLineCodeIgnoreCase(fId));
                if (loan.isPresent()) {
                    exposure += Math.max(0, loan.get().getOutstandingBalance());
                }
            }
        }
        double required = Math.max(Math.max(0, collateral.getValuationAmount()), exposure);
        double configured = configurationService.getMinimumCoverageAdequacyPct() / 100.0;
        double requiredWithThreshold = required * configured;
        if (policy.getInsuredAmount() + 1e-9 < requiredWithThreshold) {
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                "Insured amount %.2f is below the configured coverage requirement %.2f (collateral value %.2f, outstanding exposure %.2f, threshold %.1f%%).",
                policy.getInsuredAmount(), requiredWithThreshold, collateral.getValuationAmount(), exposure, configurationService.getMinimumCoverageAdequacyPct()));
        }
    }

    private void validatePolicyTerm(InsurancePolicy policy, Collateral collateral) {
        LocalDate eff = parseDate(policy.getEffectiveDate(), "effective date");
        LocalDate exp = parseDate(policy.getExpiryDate(), "expiry date");
        long days = ChronoUnit.DAYS.between(eff, exp);
        String facilityType = findFacilityType(collateral.getId(), collateral.getCode());
        boolean shortTerm = facilityType != null && (facilityType.toLowerCase().contains("short") || facilityType.toLowerCase().contains("merchandise") || facilityType.toLowerCase().contains("shipment"));
        if (shortTerm) {
            String loanExpiry = findEarliestLoanExpiry(collateral.getId(), collateral.getCode());
            if (loanExpiry != null) {
                LocalDate loanExp = parseDate(loanExpiry, "loan expiry date");
                if (exp.isBefore(loanExp)) throw new IllegalArgumentException("Policy expiry must cover the linked short-term facility tenor through " + loanExp + ".");
            }
        } else if (days < configurationService.getMinimumPolicyValidityDays()) {
            throw new IllegalArgumentException("Policy validity must be at least " + configurationService.getMinimumPolicyValidityDays() + " days.");
        }
    }

    private String findFacilityType(String collateralId, String collateralCode) {
        for (LoanCollateralLink link : loanCollateralLinkRepository.findAll()) {
            if (same(link.getCollateralId(), collateralId) || same(link.getCollateralId(), collateralCode)) {
                String fId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
                if (fId != null) {
                    Optional<LoanAccount> l = loanAccountRepository.findById(fId)
                            .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(fId));
                    if (l.isPresent()) return l.get().getFacilityType();
                }
            }
        }
        return null;
    }

    private String findEarliestLoanExpiry(String collateralId, String collateralCode) {
        LocalDate earliest = null; String value = null;
        for (LoanCollateralLink link : loanCollateralLinkRepository.findAll()) {
            if (!same(link.getCollateralId(), collateralId) && !same(link.getCollateralId(), collateralCode)) continue;
            String fId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (fId == null) continue;
            Optional<LoanAccount> l = loanAccountRepository.findById(fId)
                    .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(fId));
            if (l.isEmpty() || l.get().getLineExpiryDate() == null) continue;
            try {
                LocalDate d = parseDate(l.get().getLineExpiryDate(), "loan expiry date");
                if (earliest == null || d.isBefore(earliest)) { earliest = d; value = l.get().getLineExpiryDate(); }
            } catch (Exception ignored) {}
        }
        return value;
    }

    public void validateMandatoryDocuments(Collateral collateral) {
        if (!configurationService.areMandatoryDocumentRulesEnabled()) return;
        List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll();
        List<OwnershipDocument> docs = ownershipDocumentRepository.findAll();
        List<String> missingMandatoryDocs = new ArrayList<>();

        for (MandatoryDocumentRule rule : rules) {
            if (!rule.isMandatory()) continue;
            if (!categoryMatches(rule.getCollateralCategory(), collateral)) continue;

            boolean satisfied = docs.stream().anyMatch(d -> {
                if (!documentBelongsToCollateral(d, collateral)) return false;
                if ("Rejected".equalsIgnoreCase(d.getVerificationStatus()) || "Archived".equalsIgnoreCase(d.getStatus())) return false;
                
                // 1. Exact document type matching
                boolean typeMatch = docTypeMatches(rule.getDocumentType(), d.getType()) || docTypeMatches(rule.getDocumentType(), d.getName());
                if (!typeMatch) return false;

                // 2. Actual authentic file / reference must exist (metadata record without file is not sufficient)
                boolean hasContent = (d.getFileContent() != null && !d.getFileContent().isBlank())
                        || (d.getDmsRef() != null && !d.getDmsRef().isBlank());
                return hasContent;
            });

            if (!satisfied) {
                missingMandatoryDocs.add(rule.getDocumentType());
            }
        }

        if (!missingMandatoryDocs.isEmpty()) {
            String colRef = collateral.getCode() != null && !collateral.getCode().isBlank() ? collateral.getCode() : collateral.getId();
            StringBuilder msg = new StringBuilder("Collateral cannot be activated. Missing mandatory documents for ")
                    .append(colRef).append(":\n");
            for (String m : missingMandatoryDocs) {
                msg.append("* ").append(m).append("\n");
            }
            throw new IllegalArgumentException(msg.toString().trim());
        }
    }

    public void validateMandatoryDocumentsVerified(Collateral collateral) {
        // In the current CIMS production phase, external/government document verification is not enabled and must NOT block activation.
        // Document completeness (presence of authentic mandatory uploaded files) is validated.
        validateMandatoryDocuments(collateral);
    }

    public boolean documentBelongsToCollateral(OwnershipDocument d, Collateral collateral) {
        if (d == null || collateral == null) return false;
        if (same(collateral.getId(), d.getCollateralId()) || same(collateral.getCode(), d.getCollateralId())) return true;
        if (same(collateral.getId(), d.getEntityId()) || same(collateral.getCode(), d.getEntityId())) return true;
        return false;
    }

    public boolean docTypeMatches(String ruleDocType, String actualDocType) {
        if (ruleDocType == null || actualDocType == null) return false;
        String r = ruleDocType.trim().toLowerCase().replaceAll("[^a-z0-9]", " ").replaceAll("\\s+", " ").trim();
        String a = actualDocType.trim().toLowerCase().replaceAll("[^a-z0-9]", " ").replaceAll("\\s+", " ").trim();

        if (r.equals(a)) return true;

        // Canonical mapping per Part E rules
        // Title Deed / Property Ownership Certificate
        boolean rIsTitle = r.contains("title deed") || r.contains("property ownership") || r.contains("ownership cert");
        boolean aIsTitle = a.contains("title deed") || a.contains("property ownership") || a.contains("ownership cert");
        if (rIsTitle && aIsTitle) return true;
        if (rIsTitle != aIsTitle && (rIsTitle || aIsTitle)) {
            // If one is title deed and other is something else (like valuation or building plan), do NOT match
            if (a.contains("valuation") || a.contains("building plan") || a.contains("logbook") || a.contains("vehicle reg")) return false;
        }

        // Approved Building Plan / Cadastral / Site Plan
        boolean rIsPlan = r.contains("building plan") || r.contains("cadastral") || r.contains("site plan");
        boolean aIsPlan = a.contains("building plan") || a.contains("cadastral") || a.contains("site plan");
        if (rIsPlan && aIsPlan) return true;
        if (rIsPlan != aIsPlan && (rIsPlan || aIsPlan)) {
            if (a.contains("title deed") || a.contains("valuation") || a.contains("vehicle")) return false;
        }

        // Vehicle Registration Certificate / Logbook / Libre
        boolean rIsVehicle = r.contains("vehicle") || r.contains("logbook") || r.contains("libre");
        boolean aIsVehicle = a.contains("vehicle") || a.contains("logbook") || a.contains("libre");
        if (rIsVehicle && aIsVehicle) return true;
        if (rIsVehicle != aIsVehicle && (rIsVehicle || aIsVehicle)) {
            if (a.contains("title deed") || a.contains("building") || a.contains("machinery")) return false;
        }

        // Valuation Report
        boolean rIsVal = r.contains("valuation");
        boolean aIsVal = a.contains("valuation");
        if (rIsVal && aIsVal) return true;
        if (rIsVal != aIsVal && (rIsVal || aIsVal)) {
            if (a.contains("title deed") || a.contains("building plan") || a.contains("logbook")) return false;
        }

        // Machinery Ownership / Purchase Invoice / Bill of Sale
        boolean rIsMach = r.contains("machinery");
        boolean aIsMach = a.contains("machinery") || a.contains("purchase invoice") || a.contains("bill of sale");
        if (rIsMach && aIsMach) return true;

        // Commercial Registration / Trade License
        boolean rIsComm = r.contains("commercial registration") || r.contains("trade license");
        boolean aIsComm = a.contains("commercial registration") || a.contains("trade license");
        if (rIsComm && aIsComm) return true;

        return false;
    }

    public boolean categoryMatches(String ruleCategory, Collateral c) {
        if (ruleCategory == null || ruleCategory.isBlank() || "All".equalsIgnoreCase(ruleCategory.trim())) return true;
        if (same(ruleCategory, c.getCategory()) || same(ruleCategory, c.getType())) return true;
        String x = ruleCategory.toLowerCase();
        String cat = (c.getCategory() == null ? "" : c.getCategory()).toLowerCase();
        String typ = (c.getType() == null ? "" : c.getType()).toLowerCase();

        boolean isRuleImmovable = x.contains("immovable") || x.contains("real") || x.contains("building");
        boolean isCatImmovable = cat.contains("immovable") || cat.contains("real") || cat.contains("building") ||
                                 typ.contains("immovable") || typ.contains("building") || typ.contains("real");

        if (isRuleImmovable) {
            return isCatImmovable;
        }

        if (isCatImmovable) {
            return false;
        }

        if (x.contains("vehicle") || x.contains("movable")) {
            return cat.contains("movable") || cat.contains("vehicle") ||
                   typ.contains("movable") || typ.contains("vehicle");
        }
        if (x.contains("machinery") || x.contains("business mortgage")) {
            return cat.contains("machin") || cat.contains("business mortgage") || cat.contains("movable") ||
                   typ.contains("machin") || typ.contains("business mortgage");
        }
        if (x.contains("guarantee")) {
            return cat.contains("guarantee") || typ.contains("guarantee");
        }
        if (x.contains("agricultural") || x.contains("livestock") || x.contains("farm") || x.contains("warehouse") || x.contains("other")) {
            return cat.contains("agricultural") || cat.contains("other") || cat.contains("livestock") || cat.contains("farm") || cat.contains(x) ||
                   typ.contains("agricultural") || typ.contains("other") || typ.contains("livestock") || typ.contains("farm");
        }
        return false;
    }

    private void validateTaxonomy(Collateral collateral){
        List<CollateralTaxonomy> rows=collateralTaxonomyRepository.findAll();
        if(rows.isEmpty()) return;

        String category = collateral.getCategory() == null ? "" : collateral.getCategory().trim();
        String type = collateral.getType() == null ? "" : collateral.getType().trim();

        boolean genericType = !type.isBlank() && type.equalsIgnoreCase(category);

        boolean categoryMatch = rows.stream().anyMatch(t ->
            t.getCategory() != null && t.getCategory().trim().equalsIgnoreCase(category));
        if (!categoryMatch) {
            throw new IllegalArgumentException("Collateral category is not present in the active CIMS taxonomy: " + category);
        }

        if (type.isBlank() || genericType) return;

        boolean subCategoryMatch = rows.stream().anyMatch(t ->
            t.getCategory() != null &&
            t.getCategory().trim().equalsIgnoreCase(category) &&
            t.getSubCategory() != null &&
            (t.getSubCategory().trim().equalsIgnoreCase(type) ||
             t.getSubCategory().toLowerCase().contains(type.toLowerCase()) ||
             type.toLowerCase().contains(t.getSubCategory().toLowerCase())));

        if (!subCategoryMatch) {
            throw new IllegalArgumentException("Collateral type '" + type + "' is not configured under taxonomy category '" + category + "'.");
        }
    }

    private LocalDate parseDate(String value,String label){try{return LocalDate.parse(value.substring(0,10));}catch(Exception e){throw new IllegalArgumentException("Invalid " + label + ". Use yyyy-MM-dd.");}}
    public boolean same(String a,String b){return a!=null&&b!=null&&a.trim().equalsIgnoreCase(b.trim());}
}
