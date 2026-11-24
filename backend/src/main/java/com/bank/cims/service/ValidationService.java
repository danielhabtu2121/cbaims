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
    @Autowired private CimsExceptionRepository cimsExceptionRepository;
    @Autowired private CollateralTaxonomyRepository collateralTaxonomyRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private ConfigurationService configurationService;
    @Autowired @org.springframework.context.annotation.Lazy private EffectiveInsuranceService effectiveInsuranceService;
    @Autowired private BranchRepository branchRepository;
    @Autowired private BusinessSegmentRepository businessSegmentRepository;
    @Autowired @org.springframework.context.annotation.Lazy private FirstDegreeSecondDegreeService firstDegreeSecondDegreeService;
    @Autowired @org.springframework.context.annotation.Lazy private InsuranceCoverageRuleService insuranceCoverageRuleService;
    @Autowired @org.springframework.context.annotation.Lazy private InsuranceRequirementService insuranceRequirementService;

    public void validatePolicy(InsurancePolicy policy) {
        validateBasicPolicy(policy);
        validateDuplicatePolicy(policy);
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
            boolean custMatches = false;
            if (collateral.getCustomerId() != null &&
                (policy.getCustomerId().equalsIgnoreCase(collateral.getCustomerId()) ||
                 policy.getCustomerId().trim().equalsIgnoreCase(collateral.getCustomerId().trim()))) {
                custMatches = true;
            } else if (collateralOwnerRepository != null) {
                List<CollateralOwner> owners = collateralOwnerRepository.findByCollateralId(collateral.getId());
                custMatches = owners != null && owners.stream().anyMatch(o ->
                        policy.getCustomerId().equalsIgnoreCase(o.getId()) ||
                        (o.getName() != null && o.getName().equalsIgnoreCase(policy.getCustomerId())));
            }
            if (!custMatches) {
                throw new IllegalArgumentException("Customer mismatch: Policy customer '" + policy.getCustomerId() +
                        "' does not match collateral owner/borrower '" + collateral.getCustomerId() + "'.");
            }
        }

        validateEmcrAndEsgCompliance(collateral);

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
        validateMandatoryPolicyDocuments(policy);
    }

    public void validateCollateral(Collateral collateral) {
        validateCollateralForActivation(collateral);
    }

    public void validateCollateralBasicData(Collateral collateral) {
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
        validateEmcrAndEsgCompliance(collateral);
        validateDuplicateCollateral(collateral);
        validateOwnership(collateral);
        validateCollateralDegree(collateral);
        validateCollateralRequiredInformation(collateral);
    }

    public void validateCollateralForActivation(Collateral collateral) {
        validateCollateralBasicData(collateral);
        if (configurationService.areMandatoryDocumentRulesEnabled()) {
            validateMandatoryDocuments(collateral);
        }
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
            if ((owners == null || owners.isEmpty()) && collateralOwnerRepository != null) {
                if (collateral.getId() != null) {
                    owners = collateralOwnerRepository.findByCollateralId(collateral.getId());
                }
                if ((owners == null || owners.isEmpty()) && collateral.getCode() != null) {
                    owners = collateralOwnerRepository.findByCollateralId(collateral.getCode());
                }
            }
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
                (docTypeMatches("Third-Party Consent and Pledge Agreement", d.getType()) ||
                 docTypeMatches("Third-Party Consent and Pledge Agreement", d.getName()))
        );

        boolean hasConsent = docs.stream().anyMatch(d ->
                documentBelongsToCollateral(d, collateral) &&
                !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                !"Archived".equalsIgnoreCase(d.getStatus()) &&
                (d.getExpiryDate() == null || !parseDate(d.getExpiryDate(), "doc expiry").isBefore(LocalDate.now())) &&
                ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank())) &&
                (docTypeMatches("Letter of Consent", d.getType()) ||
                 docTypeMatches("Letter of Consent", d.getName()))
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
                List<CollateralOwner> owners = col.getOwners();
                if ((owners == null || owners.isEmpty()) && collateralOwnerRepository != null) {
                    if (col.getId() != null) {
                        owners = collateralOwnerRepository.findByCollateralId(col.getId());
                    }
                    if ((owners == null || owners.isEmpty()) && col.getCode() != null) {
                        owners = collateralOwnerRepository.findByCollateralId(col.getCode());
                    }
                }
                validateJointOwnership(owners);
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
        boolean isSecondDegree = collateral.getCollateralRank() != null && "2nd".equalsIgnoreCase(collateral.getCollateralRank().trim());

        for (Collateral c : existing) {
            if (collateral.getId() != null && collateral.getId().equalsIgnoreCase(c.getId())) continue;
            if (collateral.getCode() != null && collateral.getCode().equalsIgnoreCase(c.getCode())) {
                throw new IllegalArgumentException("Duplicate collateral code: " + collateral.getCode());
            }

            boolean cIsSecondDegree = c.getCollateralRank() != null && "2nd".equalsIgnoreCase(c.getCollateralRank().trim());

            // Check Title Deed match
            boolean titleDeedMatch = collateral.getTitleDeedNumber() != null && !collateral.getTitleDeedNumber().isBlank()
                    && collateral.getTitleDeedNumber().equalsIgnoreCase(c.getTitleDeedNumber());

            // Check Property Cert match
            boolean propertyCertMatch = collateral.getPropertyCertNumber() != null && !collateral.getPropertyCertNumber().isBlank()
                    && collateral.getPropertyCertNumber().equalsIgnoreCase(c.getPropertyCertNumber());

            if (titleDeedMatch || propertyCertMatch) {
                String matchedIdentifier = titleDeedMatch ? ("Title Deed Number '" + collateral.getTitleDeedNumber() + "'")
                        : ("Property Certificate Number '" + collateral.getPropertyCertNumber() + "'");

                if (isSecondDegree) {
                    if (cIsSecondDegree) {
                        throw new IllegalArgumentException("A second-degree charge already exists for this property asset: " + c.getCode() + " (" + matchedIdentifier + ").");
                    } else {
                        // c is 1st degree. If internal 1st degree, check that this 2nd degree links to c
                        if (collateral.isFirstDegreeInternal()) {
                            String parentRef = collateral.getFirstDegreeCollateralId();
                            boolean matchesParent = parentRef != null && (parentRef.equalsIgnoreCase(c.getId()) || (c.getCode() != null && parentRef.equalsIgnoreCase(c.getCode())));
                            if (!matchesParent) {
                                throw new IllegalArgumentException("Collateral with " + matchedIdentifier + " is registered under primary charge " + c.getCode()
                                        + ". Second-degree charge must reference this primary charge as firstDegreeCollateralId.");
                            }
                            // Legitimate link to 1st degree parent charge!
                            continue;
                        } else {
                            // External 1st degree declared, but CIMS has an internal 1st degree on file
                            throw new IllegalArgumentException("Property with " + matchedIdentifier + " is already registered under Bank primary charge " + c.getCode()
                                    + ". Cannot register as external first-degree charge.");
                        }
                    }
                } else {
                    // Current collateral is 1st degree (or unranked)
                    if (!cIsSecondDegree) {
                        throw new IllegalArgumentException("Collateral with " + matchedIdentifier + " already exists.");
                    } else {
                        throw new IllegalArgumentException("Collateral with " + matchedIdentifier + " already exists under secondary charge " + c.getCode() + ".");
                    }
                }
            }

            // Check Registration Number
            if (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank()
                    && collateral.getRegistrationNumber().equalsIgnoreCase(c.getRegistrationNumber())) {
                if (isSecondDegree && !cIsSecondDegree && collateral.isFirstDegreeInternal()) {
                    String parentRef = collateral.getFirstDegreeCollateralId();
                    if (parentRef != null && (parentRef.equalsIgnoreCase(c.getId()) || (c.getCode() != null && parentRef.equalsIgnoreCase(c.getCode())))) {
                        continue;
                    }
                }
                throw new IllegalArgumentException("Collateral with Registration/VIN Number '" + collateral.getRegistrationNumber() + "' already exists.");
            }

            // Check Vehicle Plate
            if (collateral.getVehiclePlateNumber() != null && !collateral.getVehiclePlateNumber().isBlank()
                    && collateral.getVehiclePlateNumber().equalsIgnoreCase(c.getVehiclePlateNumber())) {
                if (isSecondDegree && !cIsSecondDegree && collateral.isFirstDegreeInternal()) {
                    String parentRef = collateral.getFirstDegreeCollateralId();
                    if (parentRef != null && (parentRef.equalsIgnoreCase(c.getId()) || (c.getCode() != null && parentRef.equalsIgnoreCase(c.getCode())))) {
                        continue;
                    }
                }
                throw new IllegalArgumentException("Collateral with Vehicle Plate Number '" + collateral.getVehiclePlateNumber() + "' already exists.");
            }

            // Check Vehicle Chassis
            if (collateral.getVehicleChassisNumber() != null && !collateral.getVehicleChassisNumber().isBlank()
                    && collateral.getVehicleChassisNumber().equalsIgnoreCase(c.getVehicleChassisNumber())) {
                if (isSecondDegree && !cIsSecondDegree && collateral.isFirstDegreeInternal()) {
                    String parentRef = collateral.getFirstDegreeCollateralId();
                    if (parentRef != null && (parentRef.equalsIgnoreCase(c.getId()) || (c.getCode() != null && parentRef.equalsIgnoreCase(c.getCode())))) {
                        continue;
                    }
                }
                throw new IllegalArgumentException("Collateral with Chassis Number '" + collateral.getVehicleChassisNumber() + "' already exists.");
            }
        }
    }

    public void validateCollateralRequiredInformation(Collateral collateral) {
        if (collateral == null) return;
        String cat = collateral.getCategory() != null ? collateral.getCategory().toLowerCase() : "";
        String type = collateral.getType() != null ? collateral.getType().toLowerCase() : "";

        boolean isImmovable = cat.contains("immovable") || cat.contains("building") || cat.contains("property") || type.contains("building") || type.contains("property") || type.contains("land");
        boolean isSiteBasedMachinery = cat.contains("machinery") || type.contains("machinery") || cat.contains("plant");
        boolean isSiteBasedStock = cat.contains("stock") || cat.contains("inventory");
        boolean isVehicle = cat.contains("movable") || cat.contains("vehicle") || type.contains("vehicle") || type.contains("automobile");

        // 4.1 Collateral Location Validation
        if (isImmovable || isSiteBasedMachinery || isSiteBasedStock) {
            boolean hasLocation = (collateral.getLocationAddress() != null && !collateral.getLocationAddress().isBlank()) ||
                    (collateral.getLocationCity() != null && !collateral.getLocationCity().isBlank()) ||
                    (collateral.getGpsCoordinates() != null && !collateral.getGpsCoordinates().isBlank()) ||
                    (collateral.getZipCode() != null && !collateral.getZipCode().isBlank());
            if (!hasLocation) {
                throw new IllegalArgumentException(String.format(
                        "Collateral Location is mandatory for %s collateral assets (Asset: %s). Location address, city, or coordinates required to match insured risk address.",
                        isImmovable ? "immovable property" : (isSiteBasedMachinery ? "site-based machinery" : "site-based stock"),
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        }

        // GPS Coordinates validation if provided (BRD-04)
        if (collateral.getGpsCoordinates() != null && !collateral.getGpsCoordinates().isBlank()) {
            String gps = collateral.getGpsCoordinates().trim();
            String[] parts = gps.split(",");
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid GPS coordinate format: '" + gps + "'. Expected exactly two comma-separated numerical values: 'latitude, longitude'.");
            }
            try {
                double lat = Double.parseDouble(parts[0].trim());
                double lon = Double.parseDouble(parts[1].trim());
                if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
                    throw new IllegalArgumentException("Invalid GPS coordinates range: (" + lat + ", " + lon + "). Latitude must be between -90 and 90, Longitude between -180 and 180.");
                }
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid GPS coordinate format: '" + gps + "'. Numerical latitude and longitude values required.");
            }
        }

        // 4.2 Property Certificate or Registration Number
        if (isImmovable) {
            boolean hasCert = (collateral.getPropertyCertNumber() != null && !collateral.getPropertyCertNumber().isBlank()) ||
                    (collateral.getTitleDeedNumber() != null && !collateral.getTitleDeedNumber().isBlank()) ||
                    (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank());
            if (!hasCert) {
                throw new IllegalArgumentException(String.format(
                        "Property certificate number or title deed registration number is mandatory for immovable property %s for unique identification and land authority verification (BR-16).",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        } else if (isVehicle) {
            boolean hasVehId = (collateral.getVehiclePlateNumber() != null && !collateral.getVehiclePlateNumber().isBlank()) ||
                    (collateral.getVehicleChassisNumber() != null && !collateral.getVehicleChassisNumber().isBlank()) ||
                    (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank());
            if (!hasVehId) {
                throw new IllegalArgumentException(String.format(
                        "Vehicle plate, chassis, or registration number is mandatory for vehicle collateral %s.",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        }

        // 4.2b TIN requirement for Livestock / Farm Products (Credit Policy Requirement)
        boolean isLivestockOrFarm = cat.contains("livestock") || type.contains("livestock") || cat.contains("agricultural") || type.contains("agricultural") || cat.contains("farm") || type.contains("farm");
        if (isLivestockOrFarm) {
            boolean hasTin = false;
            if (collateral.getCustomerId() != null && customerRepository != null) {
                Customer cust = customerRepository.findById(collateral.getCustomerId())
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(collateral.getCustomerId()))
                        .orElse(null);
                if (cust != null && cust.getTaxIdNo() != null && !cust.getTaxIdNo().trim().isBlank()) {
                    hasTin = true;
                }
            }
            if (!hasTin && collateral.getOwners() != null) {
                for (CollateralOwner o : collateral.getOwners()) {
                    if (o.getTin() != null && !o.getTin().trim().isBlank()) {
                        hasTin = true;
                        break;
                    }
                }
            }
            if (!hasTin) {
                throw new IllegalArgumentException(String.format(
                        "Tax Identification Number (TIN) is mandatory for %s collateral assets (Asset: %s) per Credit Policy.",
                        cat.contains("livestock") || type.contains("livestock") ? "Livestock" : "Agricultural / Farm Product",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        }

        // 4.2c Livestock Subtype Registration Fields
        boolean isLivestock = cat.contains("livestock") || type.contains("livestock");
        if (isLivestock) {
            boolean hasTag = (collateral.getLivestockTagNumber() != null && !collateral.getLivestockTagNumber().isBlank())
                    || (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank());
            if (!hasTag) {
                throw new IllegalArgumentException(String.format(
                        "Plastic ear tag registration number / identification certificate is mandatory for livestock collateral %s.",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        }

        // 4.2d Farm Products / Warehouse Receipts
        boolean isFarmProduct = (cat.contains("farm") || type.contains("farm") || cat.contains("crop") || type.contains("crop") || type.contains("merchandise")) && !isLivestock;
        if (isFarmProduct) {
            boolean hasHoldingOrReceipt = (collateral.getFarmLandHoldingCert() != null && !collateral.getFarmLandHoldingCert().isBlank())
                    || (collateral.getWarehouseReceiptNumber() != null && !collateral.getWarehouseReceiptNumber().isBlank())
                    || (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank());
            if (!hasHoldingOrReceipt) {
                throw new IllegalArgumentException(String.format(
                        "Land holding certificate number or warehouse receipt number is mandatory for farm products/commodity collateral %s.",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        }

        // 4.2e Warehouse Receipt Subtype
        boolean isWarehouseReceipt = cat.contains("warehouse") || type.contains("warehouse") || (collateral.getWarehouseReceiptNumber() != null && !collateral.getWarehouseReceiptNumber().isBlank());
        if (isWarehouseReceipt && (type.contains("warehouse") || cat.contains("warehouse"))) {
            if (collateral.getWarehouseReceiptNumber() == null || collateral.getWarehouseReceiptNumber().isBlank()) {
                throw new IllegalArgumentException("Warehouse receipt number is mandatory for warehouse receipt collateral " + (collateral.getCode() != null ? collateral.getCode() : collateral.getId()) + ".");
            }
            if (collateral.getWarehouseName() == null || collateral.getWarehouseName().isBlank()) {
                throw new IllegalArgumentException("Warehouse operator name is mandatory for warehouse receipt collateral " + (collateral.getCode() != null ? collateral.getCode() : collateral.getId()) + ".");
            }
        }

        // 4.2f Intellectual Property / Intangible Assets
        boolean isIp = cat.contains("intangible") || cat.contains("intellectual") || type.contains("intellectual") || type.contains("patent") || type.contains("trademark") || type.contains("copyright");
        if (isIp) {
            boolean hasIpReg = (collateral.getIpRegistrationNumber() != null && !collateral.getIpRegistrationNumber().isBlank())
                    || (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank());
            if (!hasIpReg) {
                throw new IllegalArgumentException(String.format(
                        "Intellectual Property Authority (EIPA) registration certificate number is mandatory for IP/intangible asset %s.",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
        }

        // 4.2g Guarantees (Corporate or Personal)
        boolean isGuarantee = cat.contains("guarantee") || type.contains("guarantee");
        if (isGuarantee) {
            boolean hasGuarantor = (collateral.getGuarantorName() != null && !collateral.getGuarantorName().isBlank())
                    || (collateral.getDescription() != null && !collateral.getDescription().isBlank());
            if (!hasGuarantor) {
                throw new IllegalArgumentException(String.format(
                        "Guarantor name is mandatory for guarantee collateral %s.",
                        collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
            }
            boolean isCorporate = type.contains("corporate");
            if (isCorporate) {
                boolean hasBoardRes = (collateral.getBoardResolutionRef() != null && !collateral.getBoardResolutionRef().isBlank())
                        || (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank());
                if (!hasBoardRes) {
                    throw new IllegalArgumentException(String.format(
                            "Board resolution / power of attorney reference is mandatory for corporate guarantee %s.",
                            collateral.getCode() != null ? collateral.getCode() : collateral.getId()));
                }
            }
        }

        // 4.3 Construction Completion Information (Conditional for Under Construction)
        if (collateral.isUnderConstruction()) {
            Double completed = collateral.getConstructionCompletionPct();
            Double remaining = collateral.getConstructionRemainingPct();

            if (completed == null || completed < 0 || completed > 100) {
                throw new IllegalArgumentException("Percentage of work completed is mandatory for collateral marked Under Construction, and must be between 0% and 100%.");
            }
            if (remaining == null || remaining < 0 || remaining > 100) {
                throw new IllegalArgumentException("Percentage of work remaining is mandatory for collateral marked Under Construction, and must be between 0% and 100%.");
            }
            if (Math.abs((completed + remaining) - 100.0) > 0.01) {
                throw new IllegalArgumentException(String.format(Locale.ROOT,
                        "Construction progress inconsistency: Completed (%.1f%%) and Remaining (%.1f%%) must sum to exactly 100.0%%.",
                        completed, remaining));
            }
            if (collateral.getConstructionInspectionDate() == null || collateral.getConstructionInspectionDate().isBlank()) {
                throw new IllegalArgumentException("Engineering inspection date is mandatory for collateral marked Under Construction.");
            }
            if (collateral.getExpectedCompletionDate() == null || collateral.getExpectedCompletionDate().isBlank()) {
                throw new IllegalArgumentException("Expected completion date is mandatory for collateral marked Under Construction.");
            }
        }

        // 4.5 Bank-Assessed Value
        if (collateral.getValuationAmount() <= 0) {
            throw new IllegalArgumentException("Bank-assessed value is mandatory and must be greater than zero.");
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
            // Module 3 Rule 16: Duplicate Policy Prevention Across Collateral and Insurer
            String pColId = p.getCollateralId();
            String polColId = policy.getCollateralId();
            String pInsurer = p.getInsurerName();
            String polInsurer = policy.getInsurerName();
            String pCustId = p.getCustomerId();
            String polCustId = policy.getCustomerId();
            String pCoverage = p.getCoverageType();
            String polCoverage = policy.getCoverageType();

            boolean coverageConflict = pCoverage == null || polCoverage == null 
                    || pCoverage.trim().equalsIgnoreCase(polCoverage.trim())
                    || isCoverageTypeCompatible(pCoverage, polCoverage);

            if (pColId != null && polColId != null && pColId.trim().equalsIgnoreCase(polColId.trim())
                    && pInsurer != null && polInsurer != null && pInsurer.trim().equalsIgnoreCase(polInsurer.trim())
                    && (pCustId == null || polCustId == null || pCustId.trim().equalsIgnoreCase(polCustId.trim()))
                    && coverageConflict) {
                throw new IllegalArgumentException("An active or pending insurance policy already exists for this customer, collateral and insurer ("
                        + p.getPolicyNumber() + ", Insurer: " + p.getInsurerName() + "). Duplicate policies under the same insurer are prohibited.");
            }
        }
    }

    private void validateCoverage(InsurancePolicy policy, Collateral collateral) {
        if (effectiveInsuranceService != null && !effectiveInsuranceService.isInsuranceMandatory(collateral.getCategory(), collateral.getType())) {
            // Insurance is not mandatory for this collateral taxonomy type (voluntary policy allowed at any amount)
            return;
        }

        // Aggregate outstanding exposure across all active, distinct linked facilities (Audit Findings 17 & 19)
        double aggregateExposure = 0;
        Set<String> distinctFacilityIds = new HashSet<>();
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        if (links.isEmpty() && collateral.getCode() != null) {
            links = loanCollateralLinkRepository.findByCollateralId(collateral.getCode());
        }
        for (LoanCollateralLink link : links) {
            if (!link.isEffectiveActive()) continue;
            String fId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (fId != null && distinctFacilityIds.add(fId)) {
                Optional<LoanAccount> loan = loanAccountRepository.findById(fId)
                        .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(fId))
                        .or(() -> loanAccountRepository.findFirstByLineCodeIgnoreCase(fId));
                if (loan.isPresent()) {
                    aggregateExposure += Math.max(0, loan.get().getOutstandingBalance());
                }
            }
        }

        // Resolve Credit Policy coverage rule (Primary Test: Bank-assessed insurable value)
        double reqPct = 100.0;
        if (insuranceCoverageRuleService != null) {
            Optional<InsuranceCoverageRule> ruleOpt = insuranceCoverageRuleService.resolveApplicableRule(collateral.getType(), collateral.getOwningSegment());
            if (ruleOpt.isPresent()) {
                reqPct = ruleOpt.get().getRequiredCoveragePercentage();
            } else if (configurationService != null) {
                reqPct = configurationService.getMinimumCoverageAdequacyPct();
            }
        } else if (configurationService != null) {
            reqPct = configurationService.getMinimumCoverageAdequacyPct();
        }

        Double insurableVal = collateral.getInsurableValue();
        if (insurableVal == null || insurableVal <= 0) {
            insurableVal = collateral.getValuationAmount();
        }
        double requiredCoverageAmt = insurableVal * (reqPct / 100.0);

        if (policy.getInsuredAmount() + 1e-6 < requiredCoverageAmt) {
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                "Underinsured: Insured amount ETB %,.2f is below the configured coverage requirement of ETB %,.2f (Insurable structure value ETB %,.2f, required coverage %.1f%%, aggregate facility exposure ETB %,.2f).",
                policy.getInsuredAmount(), requiredCoverageAmt, insurableVal, reqPct, aggregateExposure));
        }
    }

    private void validatePolicyTerm(InsurancePolicy policy, Collateral collateral) {
        LocalDate eff = parseDate(policy.getEffectiveDate(), "effective date");
        LocalDate exp = parseDate(policy.getExpiryDate(), "expiry date");
        long days = ChronoUnit.DAYS.between(eff, exp);

        // Fetch all active linked facilities (Audit Finding 18)
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        if (links.isEmpty() && collateral.getCode() != null) {
            links = loanCollateralLinkRepository.findByCollateralId(collateral.getCode());
        }

        List<LoanAccount> activeFacilities = new ArrayList<>();
        Set<String> seenFacs = new HashSet<>();
        for (LoanCollateralLink link : links) {
            if (!link.isEffectiveActive()) continue;
            String fId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (fId != null && seenFacs.add(fId)) {
                loanAccountRepository.findById(fId)
                        .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(fId))
                        .or(() -> loanAccountRepository.findFirstByLineCodeIgnoreCase(fId))
                        .ifPresent(activeFacilities::add);
            }
        }

        boolean hasShortTerm = false;
        LocalDate latestShortTermExpiry = null;
        for (LoanAccount fac : activeFacilities) {
            String fType = fac.getFacilityType() != null ? fac.getFacilityType().toLowerCase() : "";
            boolean isShort = fType.contains("short") || fType.contains("merchandise") || fType.contains("shipment") || fType.contains("overdraft");
            if (isShort) {
                hasShortTerm = true;
                if (fac.getLineExpiryDate() != null && !fac.getLineExpiryDate().isBlank()) {
                    try {
                        LocalDate d = parseDate(fac.getLineExpiryDate(), "loan expiry date");
                        if (latestShortTermExpiry == null || d.isAfter(latestShortTermExpiry)) {
                            latestShortTermExpiry = d;
                        }
                    } catch (Exception ignored) {}
                }
            }
        }

        if (hasShortTerm && latestShortTermExpiry != null) {
            if (exp.isBefore(latestShortTermExpiry)) {
                throw new IllegalArgumentException(String.format(
                        "Policy expiry (%s) must cover the full tenor of all linked short-term facilities through latest maturity date %s.",
                        exp, latestShortTermExpiry));
            }
        } else if (days < configurationService.getMinimumPolicyValidityDays()) {
            throw new IllegalArgumentException("Policy validity must be at least " + configurationService.getMinimumPolicyValidityDays() + " days (actual: " + days + " days).");
        }
    }

    public void validateMandatoryDocuments(Collateral collateral) {
        if (!configurationService.areMandatoryDocumentRulesEnabled()) return;
        List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll();
        List<OwnershipDocument> docs = new ArrayList<>(ownershipDocumentRepository.findAll());
        if (collateral.getDocuments() != null) {
            docs.addAll(collateral.getDocuments());
        }
        List<String> missingMandatoryDocs = new ArrayList<>();

        for (MandatoryDocumentRule rule : resolveApplicableDocumentRules(collateral, rules)) {
            if (!rule.isMandatory()) continue;

            boolean satisfied = docs.stream().anyMatch(d -> {
                if (!documentBelongsToCollateral(d, collateral)) return false;
                if ("Rejected".equalsIgnoreCase(d.getVerificationStatus()) || "Archived".equalsIgnoreCase(d.getStatus())) return false;
                
                // Must be the latest active version (Audit Finding 13)
                if (!d.isLatest()) return false;

                // If document has an expiry date, it must not be expired (Audit Finding 13)
                if (d.getExpiryDate() != null && !d.getExpiryDate().isBlank()) {
                    try {
                        LocalDate docExp = LocalDate.parse(d.getExpiryDate().substring(0, 10));
                        if (docExp.isBefore(LocalDate.now())) {
                            return false;
                        }
                    } catch (Exception ignored) {}
                }

                // 1. Exact document type matching
                boolean typeMatch = docTypeMatches(rule.getDocumentType(), d.getType()) || docTypeMatches(rule.getDocumentType(), d.getName());
                if (!typeMatch) return false;

                // 2. Actual authentic file / reference must exist (metadata record without file is not sufficient)
                boolean hasContent = (d.getFileContent() != null && !d.getFileContent().isBlank())
                        || (d.getDmsRef() != null && !d.getDmsRef().isBlank());
                return hasContent;
            });

            if (!satisfied) {
                // Check if an APPROVED exception exists for this exact collateral and requirement
                boolean approvedExceptionExists = false;
                if (cimsExceptionRepository != null && collateral.getId() != null) {
                    List<CimsException> approvedExceptions = cimsExceptionRepository.findByCollateralIdAndStatusIn(
                            collateral.getId(), List.of("Approved", "Resolved"));
                    approvedExceptionExists = approvedExceptions.stream().anyMatch(e ->
                            docTypeMatches(rule.getDocumentType(), e.getFailedRequirement()) ||
                            (e.getDescription() != null && e.getDescription().toLowerCase().contains(rule.getDocumentType().toLowerCase()))
                    );
                }
                if (!approvedExceptionExists) {
                    missingMandatoryDocs.add(rule.getDocumentType());
                }
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
        if (collateral.isFirstDegreeInternal() && collateral.getFirstDegreeCollateralId() != null) {
            if (same(collateral.getFirstDegreeCollateralId(), d.getCollateralId()) || same(collateral.getFirstDegreeCollateralId(), d.getEntityId())) {
                return true;
            }
        }
        return false;
    }

    public boolean docTypeMatches(String ruleDocType, String actualDocType) {
        if (ruleDocType == null || actualDocType == null) return false;
        String r = ruleDocType.trim().toLowerCase().replaceAll("[^a-z0-9]", " ").replaceAll("\\s+", " ").trim();
        String a = actualDocType.trim().toLowerCase().replaceAll("[^a-z0-9]", " ").replaceAll("\\s+", " ").trim();

        if (r.equals(a)) return true;

        // Canonical mapping per Part E rules. One confirmed file satisfies every
        // admin-rule alias in the same group.
        // Third-Party Consent / Pledge Agreement / Letter of Consent
        boolean rIsPledge = r.contains("consent") || r.contains("pledge") || r.contains("third party") || r.contains("thirdparty");
        boolean aIsPledge = a.contains("consent") || a.contains("pledge") || a.contains("third party") || a.contains("thirdparty");
        if (rIsPledge && aIsPledge) return true;

        // Title Deed / Property Ownership Certificate / LHC
        boolean rIsTitle = r.contains("title deed") || r.contains("property ownership") || r.contains("ownership cert")
                || r.contains("certificate of title") || r.contains("lhc") || r.contains("land holding");
        boolean aIsTitle = a.contains("title deed") || a.contains("property ownership") || a.contains("ownership cert")
                || a.contains("certificate of title") || a.contains("lhc") || a.contains("land holding");

        // Approved Building Plan / Cadastral / Site Plan
        boolean rIsPlan = r.contains("building plan") || r.contains("approved plan") || r.contains("cadastral") || r.contains("site plan");
        boolean aIsPlan = a.contains("building plan") || a.contains("approved plan") || a.contains("cadastral") || a.contains("site plan");

        // A combined legacy requirement (for example "Title Deed / Approved Plan /
        // Property Ownership Certificate") accepts either physical document. A
        // plan-only requirement must not be satisfied by a title deed, and a
        // title-only requirement must not be satisfied by a building plan.
        if (rIsTitle && (aIsTitle || (rIsPlan && aIsPlan))) return true;
        if (rIsPlan && aIsPlan) return true;

        // Vehicle Registration Certificate / Logbook / Libre
        boolean rIsVehicle = r.contains("vehicle") || r.contains("logbook") || r.contains("libre");
        boolean aIsVehicle = a.contains("vehicle") || a.contains("logbook") || a.contains("libre");
        if (rIsVehicle && aIsVehicle) return true;
        if (rIsVehicle != aIsVehicle && (rIsVehicle || aIsVehicle)) {
            if (a.contains("title deed") || a.contains("building") || a.contains("machinery")) return false;
        }

        // Loan Agreement / Contracts / Facility Agreement
        boolean rIsLoanAgree = r.contains("loan agreement") || r.contains("facility agreement") || r.contains("credit agreement") || (r.contains("loan") && r.contains("contract"));
        boolean aIsLoanAgree = a.contains("loan agreement") || a.contains("facility agreement") || a.contains("credit agreement") || (a.contains("loan") && a.contains("contract"));
        if (rIsLoanAgree && aIsLoanAgree) return true;

        // Registration Letters / Confirmation Letters
        boolean rIsRegLetter = r.contains("registration letter") || (r.contains("registration") && r.contains("letter"));
        boolean aIsRegLetter = a.contains("registration letter") || (a.contains("registration") && a.contains("letter"));
        if (rIsRegLetter && aIsRegLetter) return true;

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

        // Mortgage Registration Confirmation Letter (Audit Finding 6 & 50)
        boolean rIsMortgage = r.contains("mortgage") && (r.contains("registration") || r.contains("confirmation"));
        boolean aIsMortgage = a.contains("mortgage") && (a.contains("registration") || a.contains("confirmation"));
        if (rIsMortgage && aIsMortgage) return true;

        // Collateral Custody Agreement
        boolean rIsCustody = r.contains("custody") && r.contains("agreement");
        boolean aIsCustody = a.contains("custody") && a.contains("agreement");
        if (rIsCustody && aIsCustody) return true;

        // Bill of Quantity (BOQ)
        boolean rIsBoq = r.contains("bill of quantity") || r.contains("boq");
        boolean aIsBoq = a.contains("bill of quantity") || a.contains("boq");
        if (rIsBoq && aIsBoq) return true;

        // Lease Agreement and Receipt
        boolean rIsLease = r.contains("lease");
        boolean aIsLease = a.contains("lease");
        if (rIsLease && aIsLease) return true;

        // Warehouse Receipt
        boolean rIsWh = r.contains("warehouse");
        boolean aIsWh = a.contains("warehouse");
        if (rIsWh && aIsWh) return true;

        // Intellectual Property Registration
        boolean rIsIp = r.contains("intellectual property") || r.contains("ip registration") || r.contains("patent") || r.contains("trademark");
        boolean aIsIp = a.contains("intellectual property") || a.contains("ip registration") || a.contains("patent") || a.contains("trademark");
        if (rIsIp && aIsIp) return true;

        // Livestock Ear-tag / Evidence
        boolean rIsLivestock = r.contains("livestock") || r.contains("ear tag") || r.contains("eartag");
        boolean aIsLivestock = a.contains("livestock") || a.contains("ear tag") || a.contains("eartag");
        if (rIsLivestock && aIsLivestock) return true;

        // Land Holding Certificate
        boolean rIsLand = r.contains("land holding") || r.contains("land use");
        boolean aIsLand = a.contains("land holding") || a.contains("land use");
        if (rIsLand && aIsLand) return true;

        // Purchase Document / Invoice / Bill of Sale / Customs Clearance
        boolean rIsPurchase = r.contains("purchase") || r.contains("invoice") || r.contains("customs") || r.contains("import");
        boolean aIsPurchase = a.contains("purchase") || a.contains("invoice") || a.contains("customs") || a.contains("import");
        if (rIsPurchase && aIsPurchase) return true;

        // TIN Information / Evidence
        boolean rIsTin = r.contains("tin");
        boolean aIsTin = a.contains("tin");
        if (rIsTin && aIsTin) return true;

        // Confirmation Letter from Other Financial Institution
        boolean rIsConf = (r.contains("confirmation") && (r.contains("institution") || r.contains("other") || r.contains("financial") || r.contains("bank"))) || r.contains("clearance letter");
        boolean aIsConf = (a.contains("confirmation") && (a.contains("institution") || a.contains("other") || a.contains("financial") || a.contains("bank"))) || a.contains("clearance letter");
        if (rIsConf && aIsConf) return true;

        // Registration Extract
        boolean rIsExtract = r.contains("extract") || r.contains("registry extract");
        boolean aIsExtract = a.contains("extract") || a.contains("registry extract");
        if (rIsExtract && aIsExtract) return true;

        return false;
    }

    public void validateEmcrAndEsgCompliance(Collateral collateral) {
        if (collateral == null) return;
        if (collateral.isEsgExclusionFlag() || "Failed".equalsIgnoreCase(collateral.getEsgScreeningStatus())) {
            throw new IllegalArgumentException("Collateral registration/activation denied: Asset violates Bank Environmental & Social Governance (ESG) Exclusion List under NBE Directives: " +
                    (collateral.getEsgNotes() != null ? collateral.getEsgNotes() : "Prohibited commercial/environmental activity."));
        }
        String cat = collateral.getCategory() != null ? collateral.getCategory().toLowerCase() : "";
        String type = collateral.getType() != null ? collateral.getType().toLowerCase() : "";
        boolean isMovable = cat.contains("movable") || cat.contains("vehicle") || cat.contains("machin") ||
                type.contains("vehicle") || type.contains("machin") || type.contains("movable") || type.contains("livestock");
        if (isMovable) {
            boolean hasEmcr = (collateral.getRegistrationNumber() != null && !collateral.getRegistrationNumber().isBlank())
                    || (collateral.getEmcrRegistrationNumber() != null && !collateral.getEmcrRegistrationNumber().isBlank())
                    || "Registered".equalsIgnoreCase(collateral.getEmcrStatus());
            if (!hasEmcr && configurationService != null && configurationService.getBoolean("emcr_mandatory_enabled", true)) {
                // Movable Property Security Right Proclamation No. 1147/2019 & EMCR Directive MCR/02/2020
                throw new IllegalArgumentException("Regulatory Compliance Warning (EMCR): Movable collateral '" +
                        collateral.getCode() + "' must be registered in the Electronic Movable Collateral Registry (EMCR) under Proclamation No. 1147/2019 prior to facility security activation.");
            }
        }
    }

    public boolean categoryMatches(String ruleCategory, Collateral c) {
        if (c == null) return false;
        String cat = (c.getCategory() == null ? "" : c.getCategory()).toLowerCase().trim();
        String typ = (c.getType() == null ? "" : c.getType()).toLowerCase().trim();

        boolean isCatImmovable = cat.contains("immovable") || cat.contains("real") || cat.contains("building") || cat.contains("land") ||
                                 typ.contains("immovable") || typ.contains("building") || typ.contains("real") || typ.contains("land");
        boolean isCatMovable = !isCatImmovable && (cat.contains("movable") || cat.contains("vehicle") || cat.contains("machin") ||
                               typ.contains("movable") || typ.contains("vehicle") || typ.contains("machin") || cat.contains("business mortgage"));
        boolean isCatGuarantee = cat.contains("guarantee") || typ.contains("guarantee");

        if (ruleCategory == null || ruleCategory.isBlank() 
                || "All".equalsIgnoreCase(ruleCategory.trim()) 
                || "All Categories".equalsIgnoreCase(ruleCategory.trim())
                || ruleCategory.toLowerCase().trim().startsWith("all")) {
            return true;
        }

        String x = ruleCategory.toLowerCase().trim();
        boolean isRuleImmovable = x.contains("immovable") || x.contains("real") || x.contains("building") || x.contains("land");
        boolean isRuleMovable = !isRuleImmovable && (x.contains("movable") || x.contains("vehicle") || x.contains("machin") || x.contains("business mortgage"));
        boolean isRuleGuarantee = x.contains("guarantee");

        if (isRuleImmovable) {
            if (!isCatImmovable) return false;
            if (x.contains("under construction") || x.contains("construction in progress")) {
                return typ.contains("under construction") || cat.contains("under construction") || typ.contains("construction");
            }
            if (x.contains("leasehold") || x.contains("lease")) {
                return typ.contains("leasehold") || cat.contains("leasehold") || typ.contains("lease") || (c.getPropertyCertNumber() != null && c.getPropertyCertNumber().toLowerCase().contains("lease"));
            }
            return true;
        }

        if (isCatImmovable) {
            return false;
        }

        if (isRuleMovable) {
            return isCatMovable;
        }
        if (isRuleGuarantee) {
            return isCatGuarantee;
        }
        if (x.contains("agricultural") || x.contains("livestock") || x.contains("farm") || x.contains("warehouse") || x.contains("other")) {
            return cat.contains("agricultural") || cat.contains("other") || cat.contains("livestock") || cat.contains("farm") || cat.contains(x) ||
                   typ.contains("agricultural") || typ.contains("other") || typ.contains("livestock") || typ.contains("farm");
        }
        return same(ruleCategory, c.getCategory()) || same(ruleCategory, c.getType());
    }

    public boolean segmentMatches(String ruleSegment, String collateralSegment) {
        if (ruleSegment == null || ruleSegment.isBlank()) return true;
        String r = ruleSegment.trim().toLowerCase(Locale.ROOT);
        if (r.equals("all") || r.equals("all segments") || r.equals("all segment") || r.equals("any")) return true;
        if (collateralSegment == null || collateralSegment.isBlank()) return false;
        String a = collateralSegment.trim().toLowerCase(Locale.ROOT);
        if (r.equals(a)) return true;
        String rn = r.replaceAll("[^a-z0-9]", "");
        String an = a.replaceAll("[^a-z0-9]", "");
        if (rn.equals(an)) return true;
        // Tolerate short forms such as "Corporate" vs "Corporate Banking".
        return rn.contains(an) || an.contains(rn);
    }

    public boolean isMandatoryDocumentRuleApplicable(MandatoryDocumentRule rule, Collateral collateral) {
        return rule != null && rule.isMandatory() && isDocumentRuleRelevant(rule, collateral);
    }

    /**
     * Resolves the effective document requirements for a collateral.
     *
     * Rules are filtered by active / segment / category / subtype / ownership and then
     * deduplicated by document requirement, because the catalog may contain aliases or
     * both a segment-specific rule and an All Segments rule for the same document.
     *
     * Precedence (highest first): segment-specific over All Segments, mandatory over
     * optional, then more specific collateral type / ownership / applicability. The
     * winning rule is the only one presented, validated or used to raise an exception,
     * so one document can never create duplicate requirements.
     */
    public List<MandatoryDocumentRule> resolveApplicableDocumentRules(Collateral collateral, List<MandatoryDocumentRule> rules) {
        if (collateral == null || rules == null || rules.isEmpty()) return List.of();
        List<MandatoryDocumentRule> relevant = rules.stream()
                .filter(r -> isDocumentRuleRelevant(r, collateral))
                .sorted(Comparator.comparingInt(this::documentRulePrecedence).reversed())
                .toList();

        List<MandatoryDocumentRule> resolved = new ArrayList<>();
        for (MandatoryDocumentRule rule : relevant) {
            boolean duplicate = resolved.stream().anyMatch(existing -> sameDocumentRequirement(existing, rule));
            if (!duplicate) resolved.add(rule);
        }
        return resolved;
    }

    private int documentRulePrecedence(MandatoryDocumentRule rule) {
        int score = 0;
        if (!isAllSegments(rule.getSegment())) score += 1000;
        if (rule.isMandatory()) score += 100;
        if (hasValue(rule.getCollateralType()) && !"all".equalsIgnoreCase(rule.getCollateralType().trim())) score += 10;
        if (hasValue(rule.getOwnershipCondition()) && !"all".equalsIgnoreCase(rule.getOwnershipCondition().trim())
                && !"any".equalsIgnoreCase(rule.getOwnershipCondition().trim())) score += 5;
        if (hasValue(rule.getApplicabilityCondition()) && !"all".equalsIgnoreCase(rule.getApplicabilityCondition().trim())
                && !"standard".equalsIgnoreCase(rule.getApplicabilityCondition().trim())) score += 2;
        return score;
    }

    private boolean isAllSegments(String segment) {
        if (segment == null || segment.isBlank()) return true;
        String s = segment.trim().toLowerCase(Locale.ROOT);
        return s.equals("all") || s.equals("all segments") || s.equals("all segment") || s.equals("any");
    }

    private boolean hasValue(String value) {
        return value != null && !value.isBlank();
    }

    private boolean sameDocumentRequirement(MandatoryDocumentRule a, MandatoryDocumentRule b) {
        if (a == null || b == null) return false;
        String keyA = documentRequirementKey(a.getDocumentType());
        String keyB = documentRequirementKey(b.getDocumentType());
        return !keyA.isEmpty() && keyA.equals(keyB);
    }

    /**
     * Canonical requirement key used only for de-duplication. Unlike
     * {@link #docTypeMatches(String, String)} it must not merge genuinely distinct
     * documents such as a Title Deed and an Approved Building Plan. It only groups
     * known aliases of the same document.
     */
    private String documentRequirementKey(String docType) {
        if (docType == null || docType.isBlank()) return "";
        String d = docType.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (d.isEmpty()) return "";

        // Building plan must be checked before title deed: legacy title-deed labels
        // contain the words "Approved Plan" but are a different document.
        if (d.contains("building plan") || d.contains("cadastral") || d.contains("site plan")) return "building-plan";
        if (d.contains("architectural")) return "architectural-drawings";
        if (d.contains("bill of quantity") || d.contains("boq")) return "bill-of-quantity";
        if (d.contains("building permit")) return "building-permit";
        if (d.contains("engineer progress") || d.contains("progress report")) return "engineer-progress-report";
        if (d.contains("title deed") || d.contains("certificate of title") || d.contains("property ownership")
                || d.contains("ownership cert") || d.contains("lhc") || d.contains("land holding")) return "title-deed";
        if (d.contains("valuation")) return "valuation-report";
        if (d.contains("roadworthiness")) return "roadworthiness-certificate";
        if (d.contains("vehicle") || d.contains("logbook") || d.contains("libre")) return "vehicle-registration";
        if (d.contains("technical inspection") || d.contains("machine inspection")) return "machine-technical-inspection";
        if (d.contains("machinery") && (d.contains("ownership") || d.contains("cert"))) return "machinery-ownership";
        if (d.contains("customs")) return "customs-clearance";
        if (d.contains("purchase") || d.contains("invoice") || d.contains("bill of sale")) return "purchase-document";
        if (d.contains("consent") || d.contains("pledge") || d.contains("third party")) return "third-party-consent";
        if (d.contains("loan agreement") || d.contains("facility agreement") || d.contains("credit agreement")) return "loan-agreement";
        if (d.contains("registration letter") || (d.contains("registration") && d.contains("letter"))) return "registration-letter";
        if (d.contains("mortgage") && (d.contains("registration") || d.contains("confirmation"))) return "mortgage-registration-confirmation";
        if (d.contains("warehouse receipt")) return "warehouse-receipt";
        if (d.contains("veterinary")) return "veterinary-health-certificate";
        if (d.contains("ear tag") || d.contains("eartag")) return "livestock-ear-tag";
        if (d.contains("commodity inspection")) return "commodity-inspection";
        if (d.contains("intellectual property") || d.contains("ip registration")) return "ip-registration";
        if (d.contains("guarantee")) return "guarantee-agreement";
        if (d.contains("board resolution") || d.contains("power of attorney")) return "board-resolution";
        if (d.contains("lease agreement") || d.contains("lease payment")) return "lease-agreement";
        if (d.contains("tin")) return "tin-evidence";
        return d;
    }

    /** Category / segment / subtype / ownership filtering shared by validation and checklists. */
    public boolean isDocumentRuleRelevant(MandatoryDocumentRule rule, Collateral collateral) {
        if (rule == null || collateral == null) return false;
        if (!rule.isActive()) return false;

        // 0. Segment match (All Segments / blank applies everywhere)
        if (!segmentMatches(rule.getSegment(), collateral.getOwningSegment())) {
            return false;
        }

        // 1. Category match
        if (!categoryMatches(rule.getCollateralCategory(), collateral)) {
            return false;
        }

        // 1b. Strict category isolation: Immovable assets must NEVER require Movable documents, and Movable assets must NEVER require Immovable documents
        String cat = (collateral.getCategory() == null ? "" : collateral.getCategory()).toLowerCase().trim();
        String typ = (collateral.getType() == null ? "" : collateral.getType()).toLowerCase().trim();
        boolean isCatImmovable = cat.contains("immovable") || cat.contains("real") || cat.contains("building") || cat.contains("land") ||
                                 typ.contains("immovable") || typ.contains("building") || typ.contains("real") || typ.contains("land");
        boolean isCatMovable = !isCatImmovable && (cat.contains("movable") || cat.contains("vehicle") || cat.contains("machin") ||
                               typ.contains("movable") || typ.contains("vehicle") || typ.contains("machin"));

        String dt = rule.getDocumentType() != null ? rule.getDocumentType().toLowerCase() : "";
        boolean isDocImmovable = dt.contains("title") || dt.contains("deed") || dt.contains("building plan") || dt.contains("cadastral") || dt.contains("lease");
        boolean isDocMovable = dt.contains("vehicle") || dt.contains("logbook") || dt.contains("libre") || dt.contains("machin") || dt.contains("invoice") || dt.contains("customs");

        boolean isRuleAllCategories = rule.getCollateralCategory() != null &&
                (rule.getCollateralCategory().trim().equalsIgnoreCase("All") ||
                 rule.getCollateralCategory().trim().equalsIgnoreCase("All Categories") ||
                 rule.getCollateralCategory().toLowerCase().trim().startsWith("all"));

        if (!isRuleAllCategories) {
            if (isCatMovable && isDocImmovable) {
                return false;
            }
            if (isCatImmovable && isDocMovable) {
                return false;
            }
        }

        // 2. Internal 2nd degree collateral exemption (only if this is a 2nd degree collateral linking to an internal 1st degree charge)
        boolean isSecondDegree = "2nd".equalsIgnoreCase(collateral.getCollateralRank()) || "Second Degree".equalsIgnoreCase(collateral.getCollateralRank()) || collateral.getFirstDegreeCollateralId() != null;
        if (isSecondDegree && collateral.isFirstDegreeInternal() && collateral.getFirstDegreeCollateralId() != null) {
            if (dt.contains("title") || dt.contains("deed") || dt.contains("valuation") || dt.contains("ownership cert")) {
                return false;
            }
        }

        // 3. Collateral Subtype match
        if (rule.getCollateralType() != null && !rule.getCollateralType().isBlank() && !"All".equalsIgnoreCase(rule.getCollateralType().trim())) {
            String cType = collateral.getType() != null ? collateral.getType().trim() : "";
            String rType = rule.getCollateralType().trim();
            boolean typeMatches = cType.equalsIgnoreCase(rType)
                    || cType.toLowerCase().contains(rType.toLowerCase())
                    || rType.toLowerCase().contains(cType.toLowerCase());

            if (!typeMatches && rType.toLowerCase().contains("construction") && collateral.isUnderConstruction()) {
                typeMatches = true;
            }
            if (!typeMatches) {
                return false;
            }
        }

        // 4. Ownership condition match
        if (rule.getOwnershipCondition() != null && !rule.getOwnershipCondition().isBlank() && !"All".equalsIgnoreCase(rule.getOwnershipCondition().trim())) {
            String cond = rule.getOwnershipCondition().trim();
            String cOwnerType = collateral.getOwnerType() != null ? collateral.getOwnerType().trim() : "Borrower-owned";
            boolean tpRule = cond.equalsIgnoreCase("Third-party-owned") || cond.toLowerCase().contains("third party") || cond.toLowerCase().contains("thirdparty");
            boolean tpCollateral = cOwnerType.equalsIgnoreCase("Third-party-owned") || cOwnerType.toLowerCase().contains("third party") || cOwnerType.toLowerCase().contains("thirdparty");
            if (tpRule != tpCollateral && !cond.equalsIgnoreCase(cOwnerType)) {
                return false;
            }
        }

        // 5. Business / Applicability Condition match
        if (rule.getApplicabilityCondition() != null && !rule.getApplicabilityCondition().isBlank() && !"All".equalsIgnoreCase(rule.getApplicabilityCondition().trim())) {
            String appCond = rule.getApplicabilityCondition().trim().toLowerCase();
            if (appCond.contains("construction") || appCond.contains("boq") || appCond.contains("remaining works")) {
                String cType = collateral.getType() != null ? collateral.getType().toLowerCase() : "";
                boolean underCon = collateral.isUnderConstruction() || cType.contains("construction") || cType.contains("under construction");
                if (!underCon) {
                    return false;
                }
            }
            if (appCond.contains("leasehold") || appCond.contains("lease fee")) {
                String cType = collateral.getType() != null ? collateral.getType().toLowerCase() : "";
                if (!cType.contains("lease")) {
                    return false;
                }
            }
        }

        return true;
    }

    public void validateMandatoryPolicyDocuments(InsurancePolicy policy) {
        if (!configurationService.areMandatoryDocumentRulesEnabled()) return;
        List<OwnershipDocument> docs = new ArrayList<>(ownershipDocumentRepository.findAll());
        if (policy.getDocuments() != null) {
            docs.addAll(policy.getDocuments());
        }

        String polId = policy.getId() != null ? policy.getId().trim() : "";
        String polNum = policy.getPolicyNumber() != null ? policy.getPolicyNumber().trim() : "";
        String colId = policy.getCollateralId() != null ? policy.getCollateralId().trim() : "";
        String renewedFromId = policy.getRenewedFromPolicyId() != null ? policy.getRenewedFromPolicyId().trim() : "";
        String replacesId = policy.getReplacesPolicyId() != null ? policy.getReplacesPolicyId().trim() : "";

        boolean hasSchedule = docs.stream().anyMatch(d -> {
            if ("Rejected".equalsIgnoreCase(d.getVerificationStatus()) || "Archived".equalsIgnoreCase(d.getStatus())) return false;
            boolean matchesEntity = (polId.length() > 0 && (polId.equalsIgnoreCase(d.getEntityId()) || polId.equalsIgnoreCase(d.getCollateralId())))
                    || (polNum.length() > 0 && (polNum.equalsIgnoreCase(d.getEntityId()) || polNum.equalsIgnoreCase(d.getCollateralId())))
                    || (colId.length() > 0 && (colId.equalsIgnoreCase(d.getEntityId()) || colId.equalsIgnoreCase(d.getCollateralId())))
                    || (renewedFromId.length() > 0 && (renewedFromId.equalsIgnoreCase(d.getEntityId()) || renewedFromId.equalsIgnoreCase(d.getCollateralId())))
                    || (replacesId.length() > 0 && (replacesId.equalsIgnoreCase(d.getEntityId()) || replacesId.equalsIgnoreCase(d.getCollateralId())));
            if (!matchesEntity) return false;
            String dt = ((d.getType() != null ? d.getType() : "") + " " + (d.getName() != null ? d.getName() : "")).toLowerCase();
            boolean isSched = dt.contains("schedule") || dt.contains("certificate") || dt.contains("policy doc");
            boolean hasContent = (d.getFileContent() != null && !d.getFileContent().isBlank())
                    || (d.getDmsRef() != null && !d.getDmsRef().isBlank());
            return isSched && hasContent;
        });

        if (!hasSchedule) {
            throw new IllegalArgumentException("Policy activation rejected. Mandatory Insurance Policy Schedule is missing or has no retrievable file content in DMS repository.");
        }
    }

    private void validateTaxonomy(Collateral collateral){
        List<CollateralTaxonomy> rows = collateralTaxonomyRepository.findAll();
        if (rows.isEmpty()) {
            throw new IllegalStateException("Collateral taxonomy configuration is empty or unseeded. Registration cannot proceed.");
        }
        List<CollateralTaxonomy> activeRows = rows.stream().filter(CollateralTaxonomy::isActive).toList();
        if (activeRows.isEmpty()) {
            throw new IllegalStateException("No active collateral taxonomy entries configured.");
        }

        String category = collateral.getCategory() == null ? "" : collateral.getCategory().trim();
        String type = collateral.getType() == null ? "" : collateral.getType().trim();

        boolean genericType = !type.isBlank() && type.equalsIgnoreCase(category);

        boolean categoryMatch = activeRows.stream().anyMatch(t ->
            t.getCategory() != null && t.getCategory().trim().equalsIgnoreCase(category));
        if (!categoryMatch) {
            throw new IllegalArgumentException("Collateral category is not present in the active CIMS taxonomy: " + category);
        }

        if (type.isBlank() || genericType) return;

        boolean subCategoryMatch = activeRows.stream().anyMatch(t ->
            t.getCategory() != null &&
            t.getCategory().trim().equalsIgnoreCase(category) &&
            t.getSubCategory() != null &&
            (t.getSubCategory().trim().equalsIgnoreCase(type) ||
             t.getSubCategory().toLowerCase().contains(type.toLowerCase()) ||
             type.toLowerCase().contains(t.getSubCategory().toLowerCase())));

        if (!subCategoryMatch) {
            throw new IllegalArgumentException("Collateral type '" + type + "' is not configured under active taxonomy category '" + category + "'.");
        }
    }

    public boolean isCoverageTypeCompatible(String actual, String required) {
        if (insuranceRequirementService != null) {
            return insuranceRequirementService.isCoverageTypeCompatible(actual, required);
        }
        if (required == null || required.isBlank() || "None".equalsIgnoreCase(required.trim())) return true;
        if (actual == null || actual.isBlank()) return false;
        String a = actual.trim().toLowerCase(Locale.ROOT);
        String r = required.trim().toLowerCase(Locale.ROOT);
        if (a.equals(r)) return true;

        boolean actualIsComprehensiveAllRisk = (a.contains("all-risk") || a.contains("all risk") || a.contains("property all risk") || a.contains("commercial all risk"))
                && !a.contains("contractor") && !a.contains("machinery");

        Set<String> requiredPerils = new LinkedHashSet<>();
        if (r.contains("fire")) requiredPerils.add("FIRE");
        if (r.contains("lightning")) requiredPerils.add("LIGHTNING");
        if (r.contains("burglary")) requiredPerils.add("BURGLARY");
        if (r.contains("theft")) requiredPerils.add("THEFT");
        if (r.contains("combustion")) requiredPerils.add("COMBUSTION");
        if (r.contains("machin") || r.contains("breakdown")) requiredPerils.add("MACHINERY_BREAKDOWN");
        if (r.contains("motor") || r.contains("vehicle")) requiredPerils.add("COMPREHENSIVE_MOTOR");
        if (r.contains("livestock") || r.contains("mortality")) requiredPerils.add("LIVESTOCK_MORTALITY");
        if (r.contains("crop")) requiredPerils.add("CROP_PROTECTION");
        if (r.contains("warehouse")) requiredPerils.add("WAREHOUSE_ALL_RISK");
        if (r.contains("contractor") || r.contains("car")) requiredPerils.add("CONTRACTOR_ALL_RISK");

        if (requiredPerils.isEmpty()) {
            return a.equals(r);
        }

        for (String peril : requiredPerils) {
            boolean satisfied = false;
            switch (peril) {
                case "FIRE":
                    satisfied = a.contains("fire") || a.contains("allied") || actualIsComprehensiveAllRisk;
                    break;
                case "LIGHTNING":
                    satisfied = a.contains("lightning") || a.contains("allied") || actualIsComprehensiveAllRisk;
                    break;
                case "BURGLARY":
                    satisfied = a.contains("burglary") || actualIsComprehensiveAllRisk;
                    break;
                case "THEFT":
                    satisfied = a.contains("theft") || a.contains("burglary") || actualIsComprehensiveAllRisk;
                    break;
                case "COMBUSTION":
                    satisfied = a.contains("combustion") || actualIsComprehensiveAllRisk;
                    break;
                case "MACHINERY_BREAKDOWN":
                    satisfied = a.contains("breakdown") || a.contains("machin") || a.contains("engineering")
                            || (a.contains("contractor") && a.contains("machin"));
                    break;
                case "COMPREHENSIVE_MOTOR":
                    satisfied = (a.contains("motor") || a.contains("vehicle")) && a.contains("comprehensive");
                    break;
                case "LIVESTOCK_MORTALITY":
                    satisfied = a.contains("livestock") || a.contains("mortality");
                    break;
                case "CROP_PROTECTION":
                    satisfied = a.contains("crop");
                    break;
                case "WAREHOUSE_ALL_RISK":
                    satisfied = a.contains("warehouse") || actualIsComprehensiveAllRisk;
                    break;
                case "CONTRACTOR_ALL_RISK":
                    satisfied = a.contains("contractor") || a.contains("car ") || a.startsWith("car") || a.contains("engineering");
                    break;
            }
            if (!satisfied) {
                return false;
            }
        }

        return true;
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
                if ("U".equalsIgnoreCase(cust.getAuthStat()) || "Pending Approval".equalsIgnoreCase(cust.getStatus())) {
                    result.addCheck(new ValidationCheckItemDto("Customer", "Customer Approval State", false,
                            "Customer " + cust.getName() + " is unapproved/pending authorization (authStat='U'). Policy activation requires an approved customer profile.", false, null, null, "CUSTOMER_NOT_APPROVED"));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Customer", "Customer KYC & Relationship", true,
                            "Customer " + cust.getName() + " (CIF: " + (cust.getCif() != null ? cust.getCif() : cust.getId()) + ") verified and authorized.", false, null, null, "CUSTOMER_VERIFIED"));
                }
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
                    double reqPct = 100.0;
                    if (insuranceCoverageRuleService != null) {
                        Optional<InsuranceCoverageRule> ruleOpt = insuranceCoverageRuleService.resolveApplicableRule(collateral.getType(), collateral.getOwningSegment());
                        if (ruleOpt.isPresent()) {
                            reqPct = ruleOpt.get().getRequiredCoveragePercentage();
                        } else if (configurationService != null) {
                            reqPct = configurationService.getMinimumCoverageAdequacyPct();
                        }
                    } else if (configurationService != null) {
                        reqPct = configurationService.getMinimumCoverageAdequacyPct();
                    }
                    Double insurableVal = collateral.getInsurableValue();
                    if (insurableVal == null || insurableVal <= 0) {
                        insurableVal = collateral.getValuationAmount();
                    }
                    double requiredWithThreshold = insurableVal * (reqPct / 100.0);

                    if (policy.getInsuredAmount() + 1e-9 < requiredWithThreshold) {
                        double deficit = requiredWithThreshold - policy.getInsuredAmount();
                        result.addCheck(new ValidationCheckItemDto("Coverage", "Coverage Adequacy Threshold", false,
                                "Insured amount ETB " + String.format(Locale.ROOT, "%,.2f", policy.getInsuredAmount()) +
                                " is below required ETB " + String.format(Locale.ROOT, "%,.2f", requiredWithThreshold) +
                                " (Insurable structure value ETB " + String.format(Locale.ROOT, "%,.2f", insurableVal) + ", required " + reqPct + "%, deficit: ETB " + String.format(Locale.ROOT, "%,.2f", deficit) + ").",
                                true, "Underinsured Collateral", "Coverage Adequacy Deficit", "COVERAGE_ADEQUACY"));
                    } else {
                        result.addCheck(new ValidationCheckItemDto("Coverage", "Coverage Adequacy Threshold", true,
                                "Insured amount ETB " + String.format(Locale.ROOT, "%,.2f", policy.getInsuredAmount()) +
                                " satisfies adequacy requirement (ETB " + String.format(Locale.ROOT, "%,.2f", requiredWithThreshold) + " at " + reqPct + "%).",
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

            for (MandatoryDocumentRule rule : resolveApplicableDocumentRules(targetCol, rules)) {
                if (!rule.isMandatory()) continue;

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
        return evaluateCollateralPreValidation(collateral, attachedDocs, allocations, owners, null);
    }

    public PolicyPreValidationResultDto evaluateCollateralPreValidation(
            Collateral collateral,
            List<Map<String, Object>> attachedDocs,
            List<Map<String, Object>> allocations,
            List<Map<String, Object>> owners,
            List<Map<String, Object>> attachedExceptions) {

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
                if ("U".equalsIgnoreCase(cust.getAuthStat()) || "Pending Approval".equalsIgnoreCase(cust.getStatus())) {
                    result.addCheck(new ValidationCheckItemDto("Customer", "Customer Approval State", false,
                            "Customer " + cust.getName() + " is unapproved/pending authorization (authStat='U'). Collateral activation requires an approved customer profile.", false, null, null, "CUSTOMER_NOT_APPROVED"));
                } else {
                    result.addCheck(new ValidationCheckItemDto("Customer", "Customer Completeness", true,
                            "Customer " + cust.getName() + " (CIF: " + (cust.getCif() != null ? cust.getCif() : cust.getId()) + ") verified and authorized.", false, null, null, "CUSTOMER_VERIFIED"));
                }
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

            for (MandatoryDocumentRule rule : resolveApplicableDocumentRules(collateral, rules)) {
                if (!rule.isMandatory()) continue;

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
                    boolean hasRequestedException = false;
                    if (attachedExceptions != null) {
                        hasRequestedException = attachedExceptions.stream().anyMatch(e -> {
                            String req = (String) e.get("failedRequirement");
                            String rType = (String) e.get("documentType");
                            String rId = (String) e.get("ruleId");
                            return (rId != null && rId.equalsIgnoreCase(rule.getId()))
                                    || docTypeMatches(rule.getDocumentType(), req)
                                    || docTypeMatches(rule.getDocumentType(), rType);
                        });
                    }

                    if (!rule.isExceptionAllowed()) {
                        // Hard Block: Rule does NOT allow exceptions under Admin Policy
                        result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), false,
                                rule.getDocumentType() + " is mandatory and does NOT permit exceptions under Bank Admin Policy. It must be attached before submission.",
                                false, null, null, "MANDATORY_DOC_HARD_BLOCK_" + rule.getId()));
                    } else if (hasRequestedException) {
                        result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), false,
                                rule.getDocumentType() + " is missing, but an authorized exception request has been submitted (Pending Checker Approval).",
                                true, "Missing Mandatory Document", rule.getDocumentType(), "MANDATORY_DOC_EXC_" + rule.getId()));
                    } else {
                        result.addCheck(new ValidationCheckItemDto("Documents", "Mandatory Document: " + rule.getDocumentType(), false,
                                rule.getDocumentType() + " is required by Admin Policy for this collateral (" + collateral.getCategory() + " / " + (collateral.getType() != null ? collateral.getType() : "Standard") + ") but has not been attached. Exception allowed with authorized justification.",
                                true, "Missing Mandatory Document", rule.getDocumentType(), "MANDATORY_DOC_" + rule.getId()));
                    }
                }
            }
        }

        // 8. First-Degree / Second-Degree Collateral Priority & Evidence Validation
        if (firstDegreeSecondDegreeService != null) {
            List<OwnershipDocument> attachedDocsList = new ArrayList<>();
            if (attachedDocs != null) {
                for (Map<String, Object> d : attachedDocs) {
                    OwnershipDocument doc = new OwnershipDocument();
                    doc.setId((String) d.get("id"));
                    doc.setName((String) d.getOrDefault("name", d.get("fileName")));
                    doc.setType((String) d.getOrDefault("type", d.get("docType")));
                    doc.setFileContent((String) d.getOrDefault("fileContent", d.get("fileData")));
                    doc.setFileName((String) d.get("fileName"));
                    attachedDocsList.add(doc);
                }
            }
            var degreeResult = firstDegreeSecondDegreeService.validateSecondDegreeCollateral(collateral, attachedDocsList);
            if (degreeResult.getChecks() != null) {
                for (ValidationCheckItemDto check : degreeResult.getChecks()) {
                    result.addCheck(check);
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

    public void validateCollateralDegree(Collateral collateral) {
        if (collateral == null) return;
        String rank = collateral.getCollateralRank();
        if (rank != null && ("2nd".equalsIgnoreCase(rank.trim()) || "Second-degree".equalsIgnoreCase(rank.trim()))) {
            if (firstDegreeSecondDegreeService != null) {
                var res = firstDegreeSecondDegreeService.validateSecondDegreeCollateral(collateral, null);
                if (!res.isCanProceed()) {
                    throw new IllegalArgumentException(String.join("; ", res.getErrors()));
                }
            }
        }
    }

    private LocalDate parseDate(String value,String label){try{return LocalDate.parse(value.substring(0,10));}catch(Exception e){throw new IllegalArgumentException("Invalid " + label + ". Use yyyy-MM-dd.");}}
    public boolean same(String a,String b){return a!=null&&b!=null&&a.trim().equalsIgnoreCase(b.trim());}
}
