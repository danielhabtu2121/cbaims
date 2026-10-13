package com.bank.cims.service;

import com.bank.cims.dto.PolicyPreValidationResultDto;
import com.bank.cims.dto.ValidationCheckItemDto;
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
    @Autowired private CollateralOwnerRepository collateralOwnerRepository;
    @Autowired private OwnershipDocumentRepository ownershipDocumentRepository;
    @Autowired private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;
    @Autowired private CollateralTaxonomyRepository collateralTaxonomyRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private ConfigurationService configurationService;
    @Autowired @org.springframework.context.annotation.Lazy private EffectiveInsuranceService effectiveInsuranceService;
    @Autowired private BranchRepository branchRepository;
    @Autowired private BusinessSegmentRepository businessSegmentRepository;

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

        // Validate taxonomy mandatory coverage type if configured in SysAdmin
        if (effectiveInsuranceService != null) {
            String mandatoryCoverage = effectiveInsuranceService.getMandatoryCoverageType(collateral.getCategory(), collateral.getType());
            if (mandatoryCoverage != null && !mandatoryCoverage.isBlank()) {
                if (policy.getCoverageType() == null || policy.getCoverageType().isBlank()) {
                    throw new IllegalArgumentException("Coverage type is mandatory. Collateral taxonomy mandates coverage: " + mandatoryCoverage);
                }
                if (!isCoverageTypeCompatible(policy.getCoverageType(), mandatoryCoverage)) {
                    throw new IllegalArgumentException(String.format(
                        "Policy coverage type '%s' does not satisfy the mandatory coverage type '%s' configured for collateral category '%s' / type '%s'.",
                        policy.getCoverageType(), mandatoryCoverage, collateral.getCategory(), collateral.getType()));
                }
            }
        }

        validateDuplicatePolicy(policy);
        validateCoverage(policy, collateral);
        validatePolicyTerm(policy, collateral);
    }

    public void validateCollateralForActivation(Collateral collateral) {
        if (collateral == null) throw new IllegalArgumentException("Collateral is required.");
        if (collateral.getValuationAmount() <= 0) throw new IllegalArgumentException("Collateral valuation amount must be greater than zero.");
        if (collateral.getCode() == null || collateral.getCode().isBlank()) throw new IllegalArgumentException("Collateral code is mandatory.");
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) throw new IllegalArgumentException("Collateral category is mandatory.");
        if (collateral.getCurrency() == null || collateral.getCurrency().isBlank()) throw new IllegalArgumentException("Collateral currency is mandatory.");
        
        // Ensure owning branch is active
        if (collateral.getBranch() != null && !collateral.getBranch().isBlank() && branchRepository != null) {
            branchRepository.findAll().stream()
                .filter(b -> b.getName().equalsIgnoreCase(collateral.getBranch().trim()) || b.getCode().equalsIgnoreCase(collateral.getBranch().trim()))
                .findFirst()
                .ifPresent(b -> {
                    if (!b.isActive()) throw new IllegalArgumentException("Cannot activate collateral under inactive branch: " + b.getName());
                });
        }
        
        // Ensure owning business segment is active
        if (collateral.getOwningSegment() != null && !collateral.getOwningSegment().isBlank() && businessSegmentRepository != null) {
            businessSegmentRepository.findAll().stream()
                .filter(s -> s.getName().equalsIgnoreCase(collateral.getOwningSegment().trim()) || s.getId().equalsIgnoreCase(collateral.getOwningSegment().trim()))
                .findFirst()
                .ifPresent(s -> {
                    if (!s.isActive()) throw new IllegalArgumentException("Cannot activate collateral under inactive business segment: " + s.getName());
                });
        }

        validateTaxonomy(collateral);
        validateDuplicateCollateral(collateral);
        validateOwnership(collateral);
        if (configurationService.areMandatoryDocumentRulesEnabled()) validateMandatoryDocuments(collateral);
    }

    public void validateOwnership(Collateral collateral) {
        if (collateral == null) throw new IllegalArgumentException("Collateral is required.");
        String ownerType = collateral.getOwnerType();
        if (ownerType == null || ownerType.isBlank()) {
            throw new IllegalArgumentException("Collateral ownership type is mandatory. Must be 'Borrower-owned', 'Third-party-owned', or 'Jointly-owned'.");
        }

        List<CollateralOwner> owners = collateral.getOwners();

        if ("Third-party-owned".equalsIgnoreCase(ownerType)) {
            validateThirdPartyOwnership(collateral);
        } else if ("Jointly-owned".equalsIgnoreCase(ownerType) || "Joint".equalsIgnoreCase(ownerType)) {
            if (owners == null || owners.isEmpty()) {
                throw new IllegalArgumentException("Jointly-owned collateral requires at least two legal owner records.");
            }
            validateJointOwnership(owners);
        } else {
            // Borrower-owned
            if (owners != null && !owners.isEmpty()) {
                double total = 0;
                for (CollateralOwner o : owners) {
                    if (o.getStatus() == null || "Active".equalsIgnoreCase(o.getStatus())) {
                        if (o.getPercentage() <= 0) {
                            throw new IllegalArgumentException("Ownership percentage for owner '" + o.getName() + "' must be greater than zero.");
                        }
                        total += o.getPercentage();
                    }
                }
                if (Math.abs(total - 100.0) > 0.01) {
                    throw new IllegalArgumentException(String.format(Locale.ROOT,
                            "Borrower-owned collateral ownership validation failed: Active ownership percentages sum to %.2f%%, but must equal exactly 100.00%%.", total));
                }
            }
        }
    }

    public void validateThirdPartyOwnership(Collateral collateral) {
        if (collateral == null) throw new IllegalArgumentException("Collateral is required.");
        List<CollateralOwner> owners = collateral.getOwners();
        if ((owners == null || owners.isEmpty()) && collateralOwnerRepository != null) {
            owners = collateralOwnerRepository.findByCollateralId(collateral.getId());
            if ((owners == null || owners.isEmpty()) && collateral.getCode() != null) {
                owners = collateralOwnerRepository.findByCollateralId(collateral.getCode());
            }
        }
        if (owners == null || owners.isEmpty()) {
            throw new IllegalArgumentException("Third-party collateral validation failed: At least one legal owner record is mandatory. No owner records provided.");
        }

        List<CollateralOwner> activeOwners = owners.stream()
                .filter(o -> o.getStatus() == null || "Active".equalsIgnoreCase(o.getStatus()))
                .toList();

        if (activeOwners.isEmpty()) {
            throw new IllegalArgumentException("Third-party collateral validation failed: At least one active legal owner is required.");
        }

        double totalPct = 0;
        for (int i = 0; i < activeOwners.size(); i++) {
            CollateralOwner o = activeOwners.get(i);
            String ownerName = o.getName() != null ? o.getName().trim() : "";
            if (ownerName.isBlank() || "Third-Party Owner".equalsIgnoreCase(ownerName) || "Borrower".equalsIgnoreCase(ownerName)) {
                throw new IllegalArgumentException(String.format(
                        "Third-party collateral validation failed: Legal owner #%d must have a valid legal name (placeholder '%s' is not allowed).", i + 1, ownerName));
            }

            String oType = o.getOwnerType() != null ? o.getOwnerType().trim() : "Individual";
            boolean isIndividual = oType.equalsIgnoreCase("Individual");
            boolean isBusiness = oType.equalsIgnoreCase("Business Organization") || oType.equalsIgnoreCase("Corporate");

            String idNum = o.getIdNumber() != null ? o.getIdNumber().trim() : "";
            String busReg = o.getBusinessRegNo() != null ? o.getBusinessRegNo().trim() : "";
            String tin = o.getTin() != null ? o.getTin().trim() : "";

            if (isIndividual && idNum.isBlank() && tin.isBlank()) {
                if (!"Verified".equalsIgnoreCase(o.getVerificationStatus())) {
                    throw new IllegalArgumentException(String.format(
                            "Third-party collateral validation failed: Individual legal owner '%s' must have National ID, Passport, or TIN.", ownerName));
                }
            } else if (isBusiness && busReg.isBlank() && tin.isBlank()) {
                if (!"Verified".equalsIgnoreCase(o.getVerificationStatus())) {
                    throw new IllegalArgumentException(String.format(
                            "Third-party collateral validation failed: Business legal owner '%s' must have Business Registration Number or TIN.", ownerName));
                }
            } else if (idNum.isBlank() && busReg.isBlank() && tin.isBlank() && !"Verified".equalsIgnoreCase(o.getVerificationStatus())) {
                throw new IllegalArgumentException(String.format(
                        "Third-party collateral validation failed: Legal owner '%s' must have valid identification.", ownerName));
            }

            // Explicit relationship to borrower
            String rel = o.getRelationshipToBorrower() != null ? o.getRelationshipToBorrower().trim() : "";
            String fallbackRel = o.getRelationship() != null ? o.getRelationship().trim() : "";
            if (fallbackRel.equalsIgnoreCase("Borrower") || fallbackRel.toLowerCase().contains("third-party") || fallbackRel.toLowerCase().contains("third party")) {
                fallbackRel = "";
            }
            if ((rel.isBlank() || "Borrower".equalsIgnoreCase(rel)) && !fallbackRel.isBlank()) {
                rel = fallbackRel;
            }
            if ((rel.isBlank() || "Borrower".equalsIgnoreCase(rel)) && ownerName.toLowerCase().contains("guarantor")) {
                rel = "Guarantor";
            }
            if (rel.isBlank()) {
                throw new IllegalArgumentException(String.format(
                        "Third-party collateral validation failed: Legal owner '%s' must have an explicitly specified relationship to borrower (cannot be blank).", ownerName));
            }
            String relLower = rel.toLowerCase();
            boolean recognized = relLower.contains("shareholder") ||
                                 relLower.contains("parent") ||
                                 relLower.contains("director") ||
                                 relLower.contains("guarantor") ||
                                 relLower.contains("spouse") ||
                                 relLower.contains("family") ||
                                 relLower.contains("partner") ||
                                 relLower.contains("pledgor") ||
                                 relLower.contains("other");
            if (!recognized) {
                throw new IllegalArgumentException(String.format(
                        "Third-party collateral validation failed: Legal owner '%s' relationship '%s' is not a permitted relationship category. Documented categories: Shareholder, Parent Company, Director, Guarantor, Spouse, Family Member, Business Partner, Other.", ownerName, rel));
            }

            // Consent and pledge reference
            String consent = o.getConsentInfo() != null ? o.getConsentInfo().trim() : "";
            String pledgeRef = o.getPledgeAgreementRef() != null ? o.getPledgeAgreementRef().trim() : "";
            if (consent.isBlank() && pledgeRef.isBlank()) {
                if ("Verified".equalsIgnoreCase(o.getVerificationStatus())) {
                    consent = "Verified Guarantee & Consent";
                } else {
                    throw new IllegalArgumentException(String.format(
                            "Third-party collateral validation failed: Legal owner '%s' must provide consent details or pledge agreement reference.", ownerName));
                }
            }

            if (o.getPercentage() <= 0) {
                throw new IllegalArgumentException(String.format(
                        "Third-party collateral validation failed: Legal owner '%s' ownership percentage must be greater than zero.", ownerName));
            }
            totalPct += o.getPercentage();
        }

        if (Math.abs(totalPct - 100.0) > 0.01) {
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                    "Third-party collateral validation failed: Active ownership percentages sum to %.2f%%, but must equal exactly 100.00%%.", totalPct));
        }

        // Validate mandatory third-party documents
        validateThirdPartyMandatoryDocuments(collateral);
    }

    public void validateThirdPartyMandatoryDocuments(Collateral collateral) {
        if (!configurationService.areMandatoryDocumentRulesEnabled()) return;
        List<OwnershipDocument> docs = ownershipDocumentRepository.findAll();

        boolean hasPledge = docs.stream().anyMatch(d ->
                documentBelongsToCollateral(d, collateral) &&
                !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                !"Archived".equalsIgnoreCase(d.getStatus()) &&
                (d.getExpiryDate() == null || !parseDate(d.getExpiryDate(), "doc expiry").isBefore(LocalDate.now())) &&
                ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank())) &&
                docTypeMatches("Third-Party Consent and Pledge Agreement", d.getType())
        );

        boolean hasConsent = docs.stream().anyMatch(d ->
                documentBelongsToCollateral(d, collateral) &&
                !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                !"Archived".equalsIgnoreCase(d.getStatus()) &&
                (d.getExpiryDate() == null || !parseDate(d.getExpiryDate(), "doc expiry").isBefore(LocalDate.now())) &&
                ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank())) &&
                docTypeMatches("Letter of Consent", d.getType())
        );

        List<String> missing = new ArrayList<>();
        if (!hasPledge) missing.add("Third-Party Consent and Pledge Agreement");
        if (!hasConsent) missing.add("Letter of Consent");

        if (!missing.isEmpty()) {
            String colRef = collateral.getCode() != null ? collateral.getCode() : collateral.getId();
            throw new IllegalArgumentException(String.format(
                    "Third-party collateral cannot be activated because the following mandatory documents are missing for %s:\n• %s",
                    colRef, String.join("\n• ", missing)));
        }
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
                    "Allocation Overflow: Total allocated security of ETB %,.2f exceeds net collateral value (exceeds collateral Net Security Value of ETB %,.2f).", total, netCollateralValue));
        }
    }

    public void validateBorrowerLoanRelationship(Collateral col, LoanAccount loan) {
        if (col == null || loan == null) {
            throw new IllegalArgumentException("Collateral and Loan Account are required for relationship validation.");
        }
        String colCustId = col.getCustomerId();
        String loanCustId = loan.getCustomerId();

        boolean custMatches = false;
        if (colCustId != null && loanCustId != null) {
            if (colCustId.trim().equalsIgnoreCase(loanCustId.trim())) {
                custMatches = true;
            } else {
                Customer colCust = customerRepository.findById(colCustId).or(() -> customerRepository.findFirstByCifIgnoreCase(colCustId)).orElse(null);
                Customer loanCust = customerRepository.findById(loanCustId).or(() -> customerRepository.findFirstByCifIgnoreCase(loanCustId)).orElse(null);
                if (colCust != null && loanCust != null && colCust.getCif() != null && colCust.getCif().equalsIgnoreCase(loanCust.getCif())) {
                    custMatches = true;
                }
            }
        }

        if (!custMatches) {
            // Check if ownership is Third-party-owned to support explicit cross-customer third-party allocation (Section 9)
            if ("Third-party-owned".equalsIgnoreCase(col.getOwnerType())) {
                // Validate third-party legal owner and mandatory consent/pledge documents
                validateThirdPartyOwnership(col);
                // Permitted for third-party collateral when legal ownership & consent are verified
            } else {
                throw new IllegalArgumentException(
                        "Customer Isolation Violation: This facility belongs to another customer and cannot be selected for borrower-owned collateral.");
            }
        } else {
            // If ownership type is Third-party-owned, validate legal owner & consent rules:
            if ("Third-party-owned".equalsIgnoreCase(col.getOwnerType())) {
                validateThirdPartyOwnership(col);
            } else if ("Jointly-owned".equalsIgnoreCase(col.getOwnerType()) || "Joint".equalsIgnoreCase(col.getOwnerType())) {
                validateJointOwnership(col.getOwners());
            }
        }
    }

    public void validateNoDuplicateActiveLink(String collateralId, String loanAccountId, String excludeLinkId) {
        if (collateralId == null || loanAccountId == null) return;
        List<LoanCollateralLink> existing = loanCollateralLinkRepository.findByCollateralIdAndLoanAccountIdAndStatus(
                collateralId, loanAccountId, "Active");
        for (LoanCollateralLink link : existing) {
            if (excludeLinkId == null || !link.getId().equalsIgnoreCase(excludeLinkId)) {
                throw new IllegalArgumentException("This facility is already linked to this collateral.");
            }
        }
    }

    public void validateJointOwnership(List<CollateralOwner> owners) {
        if (owners == null || owners.isEmpty()) {
            throw new IllegalArgumentException("Joint ownership validation failed: At least two owners are required.");
        }
        double activeSum = 0;
        int activeCount = 0;
        for (CollateralOwner o : owners) {
            if (o.getStatus() == null || "Active".equalsIgnoreCase(o.getStatus())) {
                if (o.getPercentage() <= 0) {
                    throw new IllegalArgumentException("Ownership percentage for owner '" + o.getName() + "' must be greater than zero.");
                }
                activeSum += o.getPercentage();
                activeCount++;
            }
        }
        if (activeCount < 2) {
            throw new IllegalArgumentException("Joint ownership validation failed: At least two active owners are required.");
        }
        if (Math.abs(activeSum - 100.0) > 0.01) {
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                    "Joint ownership validation failed: Active ownership percentages sum to %.2f%%, but must equal exactly 100.00%%.",
                    activeSum));
        }
    }

    public void validateCollateralRelease(String collateralId) {
        Collateral col = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        for (LoanCollateralLink link : links) {
            if ("Released".equalsIgnoreCase(link.getStatus()) || "Historical".equalsIgnoreCase(link.getStatus())) continue;
            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId != null) {
                LoanAccount fac = loanAccountRepository.findById(facId)
                        .or(() -> loanAccountRepository.findByLoanReference(facId)).orElse(null);
                if (fac != null && fac.getOutstandingBalance() > 0 && !"Closed".equalsIgnoreCase(fac.getStatus())) {
                    throw new IllegalArgumentException(String.format(Locale.ROOT,
                            "Collateral cannot be released because it remains linked to Loan %s with an outstanding secured exposure of ETB %,.2f.",
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
            // If this is a renewal or replacement of policy 'p' (or vice versa), skip duplicate check with p
            if (policy.getRenewedFromPolicyId() != null && (policy.getRenewedFromPolicyId().equals(p.getId()) || policy.getRenewedFromPolicyId().equalsIgnoreCase(p.getPolicyNumber()))) {
                continue;
            }
            if (policy.getReplacesPolicyId() != null && (policy.getReplacesPolicyId().equals(p.getId()) || policy.getReplacesPolicyId().equalsIgnoreCase(p.getPolicyNumber()))) {
                continue;
            }
            if (p.getRenewedFromPolicyId() != null && (p.getRenewedFromPolicyId().equals(policy.getId()) || p.getRenewedFromPolicyId().equalsIgnoreCase(policy.getPolicyNumber()))) {
                continue;
            }
            if (p.getReplacesPolicyId() != null && (p.getReplacesPolicyId().equals(policy.getId()) || p.getReplacesPolicyId().equalsIgnoreCase(policy.getPolicyNumber()))) {
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
        if (effectiveInsuranceService != null && !effectiveInsuranceService.isInsuranceMandatory(collateral.getCategory(), collateral.getType())) {
            // Insurance is not mandatory for this collateral taxonomy type (voluntary policy allowed at any amount)
            return;
        }

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
            if (!rule.isMandatory() || !rule.isActive()) continue;
            if (!categoryMatches(rule.getCollateralCategory(), collateral)) continue;

            if (rule.getOwnershipCondition() != null && !rule.getOwnershipCondition().isBlank() && !"All".equalsIgnoreCase(rule.getOwnershipCondition().trim())) {
                String cOwnerType = collateral.getOwnerType() != null ? collateral.getOwnerType().trim() : "Borrower-owned";
                if (!rule.getOwnershipCondition().trim().equalsIgnoreCase(cOwnerType)) {
                    continue;
                }
            }

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
        // Third-Party Consent and Pledge Agreement
        boolean rIsPledge = r.contains("consent") && (r.contains("pledge") || r.contains("third party") || r.contains("thirdparty"));
        boolean aIsPledge = a.contains("consent") && (a.contains("pledge") || a.contains("third party") || a.contains("thirdparty"));
        if (rIsPledge && aIsPledge) return true;

        // Letter of Consent
        boolean rIsLetter = r.contains("letter") && r.contains("consent");
        boolean aIsLetter = a.contains("letter") && a.contains("consent");
        if (rIsLetter && aIsLetter) return true;

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

    public boolean isCoverageTypeCompatible(String actual, String required) {
        if (actual == null || required == null) return false;
        String a = actual.trim().toLowerCase(Locale.ROOT);
        String r = required.trim().toLowerCase(Locale.ROOT);
        if (a.equals(r) || a.contains(r) || r.contains(a)) return true;
        if (r.contains("fire") && (a.contains("fire") || a.contains("allied") || a.contains("property") || a.contains("all risk") || a.contains("commercial") || a.contains("building"))) return true;
        if (r.contains("motor") && (a.contains("motor") || a.contains("comprehensive") || a.contains("vehicle"))) return true;
        if (r.contains("machin") && (a.contains("machin") || a.contains("engineering") || a.contains("breakdown") || a.contains("all-risk") || a.contains("all risk") || a.contains("comprehensive"))) return true;
        if (r.contains("all risk") && (a.contains("all risk") || a.contains("property") || a.contains("commercial"))) return true;
        if (r.contains("marine") && (a.contains("marine") || a.contains("cargo") || a.contains("transit"))) return true;
        if (r.contains("commercial") && (a.contains("commercial") || a.contains("property") || a.contains("fire"))) return true;
        return false;
    }

    public PolicyPreValidationResultDto evaluatePolicyPreValidation(InsurancePolicy policy, List<Map<String, Object>> attachedDocs) {
        PolicyPreValidationResultDto result = new PolicyPreValidationResultDto();

        if (policy == null) {
            result.addCheck(new ValidationCheckItemDto("Completeness", "Policy Data", false, "Policy data is missing.", false, null, null, "NULL_POLICY"));
            result.setSummaryMessage("Cannot validate: No policy payload received.");
            return result;
        }

        // 1. Collateral Completeness
        Collateral collateral = null;
        if (policy.getCollateralId() == null || policy.getCollateralId().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Collateral", "Collateral Association", false,
                    "A valid collateral asset must be linked to register an insurance policy.", false, null, null, "COLLATERAL_REQUIRED"));
        } else {
            collateral = collateralRepository.findById(policy.getCollateralId())
                    .or(() -> collateralRepository.findByCode(policy.getCollateralId()))
                    .orElse(null);
            if (collateral == null) {
                result.addCheck(new ValidationCheckItemDto("Collateral", "Collateral Record", false,
                        "Linked collateral asset '" + policy.getCollateralId() + "' was not found in the bank register.", false, null, null, "COLLATERAL_NOT_FOUND"));
            } else {
                result.addCheck(new ValidationCheckItemDto("Collateral", "Collateral Asset Validated", true,
                        "Collateral " + collateral.getCode() + " (" + collateral.getCategory() + " / " + (collateral.getType() != null ? collateral.getType() : "") + ") is active and verified.", false, null, null, "COLLATERAL_VALID"));
            }
        }

        // 2. Customer Completeness
        String custId = policy.getCustomerId();
        if ((custId == null || custId.isBlank()) && collateral != null) {
            custId = collateral.getCustomerId();
        }
        if (custId != null && !custId.isBlank()) {
            final String finalCustId = custId;
            Customer cust = customerRepository.findById(finalCustId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(finalCustId))
                    .orElse(null);
            if (cust != null) {
                result.addCheck(new ValidationCheckItemDto("Customer", "Customer KYC & Relationship", true,
                        "Customer " + cust.getName() + " (CIF: " + cust.getCif() + ") verified.", false, null, null, "CUSTOMER_VERIFIED"));
            } else {
                result.addCheck(new ValidationCheckItemDto("Customer", "Customer Record", false,
                        "Associated customer CIF/ID '" + custId + "' not found.", false, null, null, "CUSTOMER_NOT_FOUND"));
            }
        } else {
            result.addCheck(new ValidationCheckItemDto("Customer", "Customer CIF", false,
                    "Customer CIF/ID is required.", false, null, null, "CUSTOMER_REQUIRED"));
        }

        // 3. Policy Number & Identification
        if (policy.getPolicyNumber() == null || policy.getPolicyNumber().trim().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Completeness", "Policy Number", false,
                    "Policy number is mandatory.", false, null, null, "POLICY_NUMBER_REQUIRED"));
        } else {
            // Check duplicate
            String polNum = policy.getPolicyNumber().trim();
            boolean isDuplicate = insurancePolicyRepository.findAll().stream().anyMatch(p ->
                    !polNum.equalsIgnoreCase(policy.getId()) &&
                    polNum.equalsIgnoreCase(p.getPolicyNumber()) &&
                    !"Cancelled".equalsIgnoreCase(p.getStatus()) &&
                    !"Rejected".equalsIgnoreCase(p.getStatus()) &&
                    !"Closed".equalsIgnoreCase(p.getStatus()) &&
                    (policy.getId() == null || !policy.getId().equalsIgnoreCase(p.getId()))
            );
            if (isDuplicate) {
                result.addCheck(new ValidationCheckItemDto("Duplicate", "Duplicate Policy Check", false,
                        "Policy number '" + polNum + "' already exists in the active policy register.", false, null, null, "DUPLICATE_POLICY"));
            } else {
                result.addCheck(new ValidationCheckItemDto("Duplicate", "Duplicate Policy Check", true,
                        "Policy number '" + polNum + "' is unique in bank records.", false, null, null, "POLICY_NUMBER_UNIQUE"));
            }
        }

        // 4. Approved Insurer
        if (policy.getInsurerName() == null || policy.getInsurerName().trim().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Insurer", "Approved Insurer Selection", false,
                    "Insurer selection is mandatory.", false, null, null, "INSURER_REQUIRED"));
        } else {
            String rawIns = policy.getInsurerName().trim();
            String pIns = rawIns.toLowerCase();
            List<ApprovedInsurer> approvedInsurers = approvedInsurerRepository.findAll();
            boolean approved = approvedInsurers.stream().anyMatch(i ->
                    i.isActive() && i.getName() != null && (
                            i.getName().equalsIgnoreCase(rawIns) ||
                            pIns.contains(i.getName().toLowerCase().replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim()) ||
                            i.getName().toLowerCase().contains(pIns.replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim())
                    )
            );
            if (approved) {
                result.addCheck(new ValidationCheckItemDto("Insurer", "Approved Insurer Master", true,
                        "Insurer '" + rawIns + "' is an active approved underwriter.", false, null, null, "INSURER_APPROVED"));
            } else {
                result.addCheck(new ValidationCheckItemDto("Insurer", "Approved Insurer Master", false,
                        "Insurer '" + rawIns + "' is not on the bank's active approved underwriter list. Management waiver required.",
                        true, "Unapproved Insurer", "Approved Insurer: " + rawIns, "UNAPPROVED_INSURER"));
            }
        }

        // 5. Policy Tenor & Dates
        if (policy.getEffectiveDate() == null || policy.getEffectiveDate().isBlank() ||
            policy.getExpiryDate() == null || policy.getExpiryDate().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Dates", "Policy Dates", false,
                    "Effective date and expiry date are mandatory.", false, null, null, "DATES_REQUIRED"));
        } else {
            try {
                LocalDate eff = LocalDate.parse(policy.getEffectiveDate().substring(0, 10));
                LocalDate exp = LocalDate.parse(policy.getExpiryDate().substring(0, 10));
                if (!exp.isAfter(eff)) {
                    result.addCheck(new ValidationCheckItemDto("Dates", "Date Chronology", false,
                            "Policy expiry date (" + policy.getExpiryDate() + ") must be strictly after effective date (" + policy.getEffectiveDate() + ").",
                            false, null, null, "DATES_INVERTED"));
                } else if (exp.isBefore(LocalDate.now())) {
                    result.addCheck(new ValidationCheckItemDto("Dates", "Policy Active Status", false,
                            "Cannot register an already-expired policy (expired on " + policy.getExpiryDate() + ").",
                            false, null, null, "POLICY_ALREADY_EXPIRED"));
                } else {
                    long days = ChronoUnit.DAYS.between(eff, exp);
                    int minDays = configurationService.getMinimumPolicyValidityDays();
                    if (days < minDays) {
                        result.addCheck(new ValidationCheckItemDto("Dates", "Policy Tenor", false,
                                "Policy tenor (" + days + " days) is below standard minimum of " + minDays + " days.",
                                true, "Policy Inconsistency", "Short Policy Tenor (" + days + " days)", "POLICY_TENOR_SHORT"));
                    } else {
                        result.addCheck(new ValidationCheckItemDto("Dates", "Policy Tenor", true,
                                "Policy tenor of " + days + " days satisfies validity rules.", false, null, null, "TENOR_VALID"));
                    }
                }
            } catch (Exception e) {
                result.addCheck(new ValidationCheckItemDto("Dates", "Date Format", false,
                        "Invalid date format: " + e.getMessage(), false, null, null, "DATE_FORMAT_INVALID"));
            }
        }

        // 6. Insurance Requirement & Coverage Adequacy
        if (collateral != null) {
            boolean isMandatory = effectiveInsuranceService.isInsuranceMandatory(collateral.getCategory(), collateral.getType());
            if (!isMandatory) {
                result.addCheck(new ValidationCheckItemDto("Coverage", "Insurance Requirement", true,
                        "Insurance is voluntary for " + collateral.getCategory() + " / " + (collateral.getType() != null ? collateral.getType() : "") + ". Any coverage amount is permissible.",
                        false, null, null, "VOLUNTARY_INSURANCE"));
            } else {
                if (policy.getInsuredAmount() <= 0) {
                    result.addCheck(new ValidationCheckItemDto("Coverage", "Insured Amount", false,
                            "Insured amount must be greater than zero.", false, null, null, "INSURED_AMOUNT_ZERO"));
                } else {
                    double exposure = 0;
                    for (LoanCollateralLink link : loanCollateralLinkRepository.findAll()) {
                        if (!same(link.getCollateralId(), collateral.getId()) && !same(link.getCollateralId(), collateral.getCode())) continue;
                        String fId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
                        if (fId != null) {
                            Optional<LoanAccount> loan = loanAccountRepository.findById(fId)
                                    .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(fId));
                            if (loan.isPresent()) {
                                exposure += Math.max(0, loan.get().getOutstandingBalance());
                            }
                        }
                    }
                    double required = Math.max(Math.max(0, collateral.getValuationAmount()), exposure);
                    double configuredThreshold = configurationService.getMinimumCoverageAdequacyPct() / 100.0;
                    double requiredWithThreshold = required * configuredThreshold;

                    if (policy.getInsuredAmount() + 1e-9 < requiredWithThreshold) {
                        double deficit = requiredWithThreshold - policy.getInsuredAmount();
                        result.addCheck(new ValidationCheckItemDto("Coverage", "Coverage Adequacy Threshold", false,
                                "Insured amount ETB " + String.format(Locale.ROOT, "%,.2f", policy.getInsuredAmount()) +
                                " is below required ETB " + String.format(Locale.ROOT, "%,.2f", requiredWithThreshold) +
                                " (Deficit: ETB " + String.format(Locale.ROOT, "%,.2f", deficit) + "). Credit policy mandates 100% adequacy.",
                                true, "Underinsured Collateral", "100% Coverage Adequacy Deficit", "COVERAGE_ADEQUACY"));
                    } else {
                        result.addCheck(new ValidationCheckItemDto("Coverage", "Coverage Adequacy Threshold", true,
                                "Insured amount ETB " + String.format(Locale.ROOT, "%,.2f", policy.getInsuredAmount()) +
                                " satisfies adequacy requirement (ETB " + String.format(Locale.ROOT, "%,.2f", requiredWithThreshold) + ").",
                                false, null, null, "COVERAGE_ADEQUATE"));
                    }
                }
            }
        }

        // 7. Mandatory Policy Documents (Schedule / Policy Certificate)
        boolean hasPolicySchedule = false;
        if (attachedDocs != null && !attachedDocs.isEmpty()) {
            for (Map<String, Object> doc : attachedDocs) {
                String type = (String) doc.get("type");
                String name = (String) doc.get("name");
                String content = (String) doc.get("fileContent");
                String fileName = (String) doc.get("fileName");
                if (type != null && (type.toLowerCase().contains("schedule") || type.toLowerCase().contains("certificate") || type.toLowerCase().contains("policy"))) {
                    if ((content != null && !content.isBlank()) || (fileName != null && !fileName.isBlank())) {
                        hasPolicySchedule = true;
                        break;
                    }
                }
            }
        }
        if (hasPolicySchedule) {
            result.addCheck(new ValidationCheckItemDto("Documents", "Policy Schedule / Certificate", true,
                    "Authentic insurance policy schedule document is attached.", false, null, null, "POLICY_SCHEDULE_ATTACHED"));
        } else {
            result.addCheck(new ValidationCheckItemDto("Documents", "Policy Schedule / Certificate", false,
                    "Insurance policy schedule / certificate is mandatory before policy registration.",
                    true, "Missing Mandatory Document", "Policy Schedule / Certificate", "MANDATORY_DOC_POLICY_SCHEDULE"));
        }

        // 8. Collateral Mandatory Documents (e.g. Title Deed, Vehicle Registration)
        if (collateral != null && configurationService.areMandatoryDocumentRulesEnabled()) {
            final Collateral targetCol = collateral;
            List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll();
            List<OwnershipDocument> existingDocs = ownershipDocumentRepository.findAll();

            for (MandatoryDocumentRule rule : rules) {
                if (!rule.isMandatory() || !rule.isActive() || !categoryMatches(rule.getCollateralCategory(), targetCol)) continue;

                if (rule.getOwnershipCondition() != null && !rule.getOwnershipCondition().isBlank() && !"All".equalsIgnoreCase(rule.getOwnershipCondition().trim())) {
                    String cOwnerType = targetCol.getOwnerType() != null ? targetCol.getOwnerType().trim() : "Borrower-owned";
                    if (!rule.getOwnershipCondition().trim().equalsIgnoreCase(cOwnerType)) {
                        continue;
                    }
                }

                // Check existing repo docs
                boolean satisfied = existingDocs.stream().anyMatch(d ->
                        documentBelongsToCollateral(d, targetCol) &&
                        !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                        !"Archived".equalsIgnoreCase(d.getStatus()) &&
                        (docTypeMatches(rule.getDocumentType(), d.getType()) || docTypeMatches(rule.getDocumentType(), d.getName())) &&
                        ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank()))
                );

                // Check newly attached docs
                if (!satisfied && attachedDocs != null) {
                    satisfied = attachedDocs.stream().anyMatch(d -> {
                        String type = (String) d.get("type");
                        String name = (String) d.get("name");
                        String content = (String) d.get("fileContent");
                        String fileName = (String) d.get("fileName");
                        boolean typeMatch = docTypeMatches(rule.getDocumentType(), type) || docTypeMatches(rule.getDocumentType(), name);
                        boolean hasContent = (content != null && !content.isBlank()) || (fileName != null && !fileName.isBlank());
                        return typeMatch && hasContent;
                    });
                }

                if (satisfied) {
                    result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), true,
                            rule.getDocumentType() + " is verified and attached in DMS repository.", false, null, null, "DOC_SATISFIED_" + rule.getId()));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), false,
                            rule.getDocumentType() + " is mandatory for " + collateral.getCode() + " (" + collateral.getCategory() + ") but is missing from DMS repository.",
                            true, "Missing Mandatory Document", rule.getDocumentType(), "MANDATORY_DOC_" + rule.getId()));
                }
            }
        }

        // Summary compilation
        boolean anyFailure = result.getChecks().stream().anyMatch(c -> !c.isPassed());
        boolean hasHardBlock = result.getChecks().stream().anyMatch(c -> !c.isPassed() && !c.isOverrideable());
        long overrideableCount = result.getChecks().stream().filter(c -> !c.isPassed() && c.isOverrideable()).count();

        result.setValid(!anyFailure);
        result.setHasHardBlock(hasHardBlock);
        result.setCanSubmitAsException(!hasHardBlock && overrideableCount > 0);

        if (!anyFailure) {
            result.setSummaryMessage("Validation Passed: All mandatory requirements satisfied.");
        } else if (hasHardBlock) {
            result.setSummaryMessage("Cannot submit normally: Hard policy rule violation(s) detected. Fix errors before submission.");
        } else {
            result.setSummaryMessage("Mandatory requirement(s) not satisfied. You may upload missing requirements or submit as an authorized exception for management approval.");
        }

        return result;
    }

    public PolicyPreValidationResultDto evaluateCollateralPreValidation(
            Collateral collateral,
            List<Map<String, Object>> attachedDocs,
            List<Map<String, Object>> allocations,
            List<Map<String, Object>> owners) {

        PolicyPreValidationResultDto result = new PolicyPreValidationResultDto();
        if (collateral == null) {
            result.addCheck(new ValidationCheckItemDto("General", "Collateral Payload", false,
                    "Collateral payload cannot be empty.", false, null, null, "COLLATERAL_PAYLOAD_NULL"));
            result.setValid(false);
            result.setHasHardBlock(true);
            result.setCanSubmitAsException(false);
            result.setSummaryMessage("Cannot submit normally: Collateral payload cannot be empty.");
            return result;
        }

        // 1. Customer Completeness
        if (collateral.getCustomerId() == null || collateral.getCustomerId().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Customer", "Customer Completeness", false,
                    "Borrower customer selection is mandatory.", false, null, null, "CUSTOMER_REQUIRED"));
        } else {
            Optional<Customer> custOpt = customerRepository.findById(collateral.getCustomerId())
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(collateral.getCustomerId()));
            if (custOpt.isEmpty()) {
                result.addCheck(new ValidationCheckItemDto("Customer", "Customer Completeness", false,
                        "Borrower CIF '" + collateral.getCustomerId() + "' not found in CBS master records.", false, null, null, "CUSTOMER_NOT_FOUND"));
            } else {
                Customer cust = custOpt.get();
                result.addCheck(new ValidationCheckItemDto("Customer", "Customer Completeness", true,
                        "Customer " + cust.getName() + " (CIF: " + cust.getCif() + ") verified in CBS master.", false, null, null, "CUSTOMER_VERIFIED"));
            }
        }

        // 2. Collateral Identification & Duplicate Check
        if (collateral.getCode() == null || collateral.getCode().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Collateral", "Collateral Asset Code", false,
                    "Collateral code is mandatory.", false, null, null, "COLLATERAL_CODE_REQUIRED"));
        } else {
            String colCode = collateral.getCode().trim();
            Optional<Collateral> dup = collateralRepository.findByCode(colCode);
            if (dup.isPresent() && (collateral.getId() == null || !dup.get().getId().equalsIgnoreCase(collateral.getId()))) {
                result.addCheck(new ValidationCheckItemDto("Collateral", "Duplicate Collateral Code", false,
                        "Collateral code '" + colCode + "' already exists in register.", false, null, null, "DUPLICATE_COLLATERAL_CODE"));
            } else {
                result.addCheck(new ValidationCheckItemDto("Collateral", "Collateral Asset Code", true,
                        "Collateral code '" + colCode + "' is unique.", false, null, null, "COLLATERAL_CODE_UNIQUE"));
            }
        }

        // 3. Category & Taxonomy
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) {
            result.addCheck(new ValidationCheckItemDto("Taxonomy", "Collateral Taxonomy", false,
                    "Collateral category is mandatory.", false, null, null, "CATEGORY_REQUIRED"));
        } else {
            result.addCheck(new ValidationCheckItemDto("Taxonomy", "Collateral Taxonomy", true,
                    "Category '" + collateral.getCategory() + "' / Type '" + (collateral.getType() != null ? collateral.getType() : collateral.getCategory()) + "' matches taxonomy catalog.", false, null, null, "TAXONOMY_VALID"));
        }

        // 4. Valuation & NSV
        if (collateral.getValuationAmount() <= 0) {
            result.addCheck(new ValidationCheckItemDto("Valuation", "Market Valuation", false,
                    "Collateral valuation amount must be greater than zero.", false, null, null, "VALUATION_ZERO"));
        } else {
            double nsv = Math.round(collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0)) * 100.0) / 100.0;
            result.addCheck(new ValidationCheckItemDto("Valuation", "Market Valuation & Net Security Value", true,
                    "Valuation of ETB " + String.format(Locale.ROOT, "%,.2f", collateral.getValuationAmount()) + " (Haircut " + collateral.getHaircut() + "%) yields Net Security Value ETB " + String.format(Locale.ROOT, "%,.2f", nsv) + ".", false, null, null, "VALUATION_VALID"));
        }

        // 5. Ownership Share Completeness & Legal Owner Validation
        String ownerType = collateral.getOwnerType() != null ? collateral.getOwnerType().trim() : "Borrower-owned";
        List<Map<String, Object>> ownersToCheck = owners;
        if (ownersToCheck == null && collateral.getOwners() != null && !collateral.getOwners().isEmpty()) {
            ownersToCheck = new ArrayList<>();
            for (CollateralOwner o : collateral.getOwners()) {
                Map<String, Object> om = new HashMap<>();
                om.put("percentage", o.getPercentage());
                om.put("name", o.getName() != null ? o.getName() : "Owner");
                om.put("ownerType", o.getOwnerType() != null ? o.getOwnerType() : "");
                om.put("idNumber", o.getIdNumber() != null ? o.getIdNumber() : "");
                om.put("businessRegistrationNumber", o.getBusinessRegNo() != null ? o.getBusinessRegNo() : "");
                om.put("tin", o.getTin() != null ? o.getTin() : "");
                om.put("relationshipToBorrower", o.getRelationshipToBorrower() != null ? o.getRelationshipToBorrower() : "");
                om.put("consentInfo", o.getConsentInfo() != null ? o.getConsentInfo() : "");
                om.put("pledgeAgreementRef", o.getPledgeAgreementRef() != null ? o.getPledgeAgreementRef() : "");
                om.put("status", o.getStatus() != null ? o.getStatus() : "Active");
                ownersToCheck.add(om);
            }
        }

        if ("Third-party-owned".equalsIgnoreCase(ownerType)) {
            if (ownersToCheck == null || ownersToCheck.isEmpty()) {
                result.addCheck(new ValidationCheckItemDto("Ownership", "Third-Party Legal Owner Details", false,
                        "Third-party collateral requires at least one registered legal owner with complete identity and documented borrower relationship.",
                        false, null, null, "THIRD_PARTY_OWNER_REQUIRED"));
            } else {
                double totalPct = 0;
                boolean anyOwnerInvalid = false;
                StringBuilder ownerErrMsg = new StringBuilder();

                for (Map<String, Object> o : ownersToCheck) {
                    String status = (String) o.getOrDefault("status", "Active");
                    if ("Historical".equalsIgnoreCase(status) || "Inactive".equalsIgnoreCase(status) || "Removed".equalsIgnoreCase(status)) {
                        continue;
                    }
                    String oName = (String) o.getOrDefault("name", "");
                    String oType = (String) o.getOrDefault("ownerType", "");
                    String idNum = (String) o.getOrDefault("idNumber", "");
                    String busReg = (String) o.getOrDefault("businessRegistrationNumber", "");
                    String tin = (String) o.getOrDefault("tin", "");
                    String rel = (String) o.getOrDefault("relationshipToBorrower", "");

                    if (oName.isBlank()) {
                        anyOwnerInvalid = true;
                        ownerErrMsg.append("Legal owner name is mandatory. ");
                    }
                    if ("Individual".equalsIgnoreCase(oType) && idNum.isBlank()) {
                        anyOwnerInvalid = true;
                        ownerErrMsg.append("Individual legal owner '").append(oName).append("' must have National ID. ");
                    } else if (("Corporate".equalsIgnoreCase(oType) || "Business".equalsIgnoreCase(oType)) && busReg.isBlank() && tin.isBlank()) {
                        anyOwnerInvalid = true;
                        ownerErrMsg.append("Corporate legal owner '").append(oName).append("' must have Business Reg or TIN. ");
                    } else if (idNum.isBlank() && busReg.isBlank() && tin.isBlank()) {
                        anyOwnerInvalid = true;
                        ownerErrMsg.append("Legal owner '").append(oName).append("' must have valid identification. ");
                    }
                    if (rel.isBlank()) {
                        anyOwnerInvalid = true;
                        ownerErrMsg.append("Legal owner '").append(oName).append("' must have explicit relationship to borrower. ");
                    }

                    Object p = o.get("percentage");
                    double pct = 0;
                    if (p instanceof Number) pct = ((Number) p).doubleValue();
                    else if (p instanceof String) {
                        try { pct = Double.parseDouble((String) p); } catch (Exception ignored) {}
                    }
                    totalPct += pct;
                }

                if (anyOwnerInvalid) {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Third-Party Owner Information", false,
                            ownerErrMsg.toString().trim(), false, null, null, "THIRD_PARTY_OWNER_INFO_INVALID"));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Third-Party Owner Information", true,
                            "Legal owner details and documented borrower relationship verified.", false, null, null, "THIRD_PARTY_OWNER_INFO_VALID"));
                }

                if (Math.abs(totalPct - 100.0) > 0.05) {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Share Completeness", false,
                            "Total active legal ownership percentages sum to " + String.format(Locale.ROOT, "%.1f", totalPct) + "%, but must equal exactly 100.0%.",
                            false, null, null, "OWNERSHIP_PCT_MISMATCH"));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Share Completeness", true,
                            "Ownership shares sum to exactly 100.0% (Valid Legal Distribution).", false, null, null, "OWNERSHIP_PCT_VALID"));
                }
            }
        } else if ("Jointly-owned".equalsIgnoreCase(ownerType) || "Joint".equalsIgnoreCase(ownerType)) {
            if (ownersToCheck == null || ownersToCheck.size() < 2) {
                result.addCheck(new ValidationCheckItemDto("Ownership", "Joint Ownership Completeness", false,
                        "Joint ownership requires at least two registered legal owners.", false, null, null, "JOINT_OWNERS_MIN_COUNT"));
            } else {
                double totalPct = 0;
                for (Map<String, Object> o : ownersToCheck) {
                    String status = (String) o.getOrDefault("status", "Active");
                    if ("Historical".equalsIgnoreCase(status) || "Inactive".equalsIgnoreCase(status) || "Removed".equalsIgnoreCase(status)) {
                        continue;
                    }
                    Object p = o.get("percentage");
                    if (p instanceof Number) totalPct += ((Number) p).doubleValue();
                    else if (p instanceof String) {
                        try { totalPct += Double.parseDouble((String) p); } catch (Exception ignored) {}
                    }
                }
                if (Math.abs(totalPct - 100.0) > 0.05) {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Share Completeness", false,
                            "Total active legal ownership percentages sum to " + String.format(Locale.ROOT, "%.1f", totalPct) + "%, but must equal exactly 100.0%.",
                            false, null, null, "OWNERSHIP_PCT_MISMATCH"));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Share Completeness", true,
                            "Ownership shares sum to exactly 100.0% (Valid Legal Distribution).", false, null, null, "OWNERSHIP_PCT_VALID"));
                }
            }
        } else {
            // Sole Borrower-owned
            if (ownersToCheck != null && !ownersToCheck.isEmpty()) {
                double totalPct = 0;
                for (Map<String, Object> o : ownersToCheck) {
                    String status = (String) o.getOrDefault("status", "Active");
                    if ("Historical".equalsIgnoreCase(status) || "Inactive".equalsIgnoreCase(status) || "Removed".equalsIgnoreCase(status)) continue;
                    Object p = o.get("percentage");
                    if (p instanceof Number) totalPct += ((Number) p).doubleValue();
                    else if (p instanceof String) {
                        try { totalPct += Double.parseDouble((String) p); } catch (Exception ignored) {}
                    }
                }
                if (Math.abs(totalPct - 100.0) > 0.05) {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Share Completeness", false,
                            "Total legal ownership percentages sum to " + String.format(Locale.ROOT, "%.1f", totalPct) + "%, but must equal exactly 100.0%.",
                            false, null, null, "OWNERSHIP_PCT_MISMATCH"));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Share Completeness", true,
                            "Ownership shares sum to exactly 100.0% (Valid Legal Distribution).", false, null, null, "OWNERSHIP_PCT_VALID"));
                }
            } else {
                result.addCheck(new ValidationCheckItemDto("Ownership", "Ownership Details", true,
                        "Sole borrower legal ownership verified.", false, null, null, "SOLE_OWNERSHIP_VALID"));
            }
        }

        // 6. Allocations & Capacity
        if (allocations != null && !allocations.isEmpty()) {
            double nsv = Math.round(collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0)) * 100.0) / 100.0;
            double totalAlloc = 0;
            for (Map<String, Object> a : allocations) {
                Object amt = a.get("allocatedAmount");
                if (amt instanceof Number) totalAlloc += ((Number) amt).doubleValue();
                else if (amt instanceof String) {
                    try { totalAlloc += Double.parseDouble((String) amt); } catch (Exception ignored) {}
                }
            }
            if (totalAlloc > nsv + 0.01) {
                result.addCheck(new ValidationCheckItemDto("Allocations", "Allocation Capacity", false,
                        "Total facility allocation (ETB " + String.format(Locale.ROOT, "%,.2f", totalAlloc) + ") exceeds Net Security Value (ETB " + String.format(Locale.ROOT, "%,.2f", nsv) + "). Over-allocation requires risk waiver.",
                        true, "Capacity Overflow", "Collateral Capacity Overflow", "ALLOCATION_OVERFLOW"));
            } else {
                result.addCheck(new ValidationCheckItemDto("Allocations", "Allocation Capacity", true,
                        "Allocated ETB " + String.format(Locale.ROOT, "%,.2f", totalAlloc) + " within Net Security Value capacity (ETB " + String.format(Locale.ROOT, "%,.2f", nsv) + ").", false, null, null, "ALLOCATION_VALID"));
            }
        }

        // 7. Mandatory Collateral Documents (Title Deed, Valuation Report, Vehicle Registration Book, etc.)
        if (configurationService.areMandatoryDocumentRulesEnabled()) {
            List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll();
            List<OwnershipDocument> existingDocs = (collateral.getId() != null)
                    ? ownershipDocumentRepository.findByCollateralId(collateral.getId())
                    : Collections.emptyList();

            for (MandatoryDocumentRule rule : rules) {
                if (!rule.isMandatory() || !rule.isActive()) continue;
                if (!categoryMatches(rule.getCollateralCategory(), collateral)) continue;

                if (rule.getOwnershipCondition() != null && !rule.getOwnershipCondition().isBlank() && !"All".equalsIgnoreCase(rule.getOwnershipCondition().trim())) {
                    String cOwnerType = collateral.getOwnerType() != null ? collateral.getOwnerType().trim() : "Borrower-owned";
                    if (!rule.getOwnershipCondition().trim().equalsIgnoreCase(cOwnerType)) {
                        continue;
                    }
                }

                // Check existing repo docs
                boolean satisfied = existingDocs.stream().anyMatch(d ->
                        !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                        !"Archived".equalsIgnoreCase(d.getStatus()) &&
                        (docTypeMatches(rule.getDocumentType(), d.getType()) || docTypeMatches(rule.getDocumentType(), d.getName())) &&
                        ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank()))
                );

                // Check newly attached docs
                if (!satisfied && attachedDocs != null) {
                    satisfied = attachedDocs.stream().anyMatch(d -> {
                        String type = (String) d.get("type");
                        String name = (String) d.get("name");
                        String content = (String) d.get("fileContent");
                        String fileName = (String) d.get("fileName");
                        boolean typeMatch = docTypeMatches(rule.getDocumentType(), type) || docTypeMatches(rule.getDocumentType(), name);
                        boolean hasContent = (content != null && !content.isBlank()) || (fileName != null && !fileName.isBlank());
                        return typeMatch && hasContent;
                    });
                }

                if (satisfied) {
                    result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), true,
                            rule.getDocumentType() + " is verified and attached in DMS repository.", false, null, null, "DOC_SATISFIED_" + rule.getId()));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), false,
                            rule.getDocumentType() + " is required for this collateral type (" + collateral.getCategory() + ") but has not been attached.",
                            true, "Missing Mandatory Document", rule.getDocumentType(), "MANDATORY_DOC_" + rule.getId()));
                }
            }
        }

        // Summary compilation
        boolean anyFailure = result.getChecks().stream().anyMatch(c -> !c.isPassed());
        boolean hasHardBlock = result.getChecks().stream().anyMatch(c -> !c.isPassed() && !c.isOverrideable());
        long overrideableCount = result.getChecks().stream().filter(c -> !c.isPassed() && c.isOverrideable()).count();

        result.setValid(!anyFailure);
        result.setHasHardBlock(hasHardBlock);
        result.setCanSubmitAsException(!hasHardBlock && overrideableCount > 0);

        if (!anyFailure) {
            result.setSummaryMessage("Validation Passed: All mandatory requirements satisfied.");
        } else if (hasHardBlock) {
            result.setSummaryMessage("Cannot submit normally: Hard policy rule violation(s) detected. Fix errors before submission.");
        } else {
            result.setSummaryMessage("Mandatory requirement(s) not satisfied. You may upload missing document(s) or submit as an authorized exception for management approval.");
        }

        return result;
    }

    private LocalDate parseDate(String value,String label){try{return LocalDate.parse(value.substring(0,10));}catch(Exception e){throw new IllegalArgumentException("Invalid " + label + ". Use yyyy-MM-dd.");}}
    public boolean same(String a,String b){return a!=null&&b!=null&&a.trim().equalsIgnoreCase(b.trim());}
}
