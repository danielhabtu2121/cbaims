package com.bank.cims.service;

import com.bank.cims.dto.CollateralQualityFindingDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CollateralDataQualityService {

    private static final Logger log = LoggerFactory.getLogger(CollateralDataQualityService.class);

    @Autowired
    private CollateralTaxonomyRepository taxonomyRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

    @Autowired
    private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private CollateralRepository collateralRepository;

    /**
     * Assesses data quality for a Collateral record.
     * Evaluates field-level status, taxonomy mapping, organizational assignment,
     * valuation, and document completeness without altering manual registration flows.
     */
    public List<CollateralQualityFindingDto> evaluateDataQuality(Collateral collateral) {
        List<CollateralQualityFindingDto> findings = new ArrayList<>();
        if (collateral == null) {
            findings.add(new CollateralQualityFindingDto("collateral", "INVALID", "Collateral entity cannot be null", "ERROR", true));
            return findings;
        }

        // 1. Taxonomy & Classification Mapping (Section 9.3)
        boolean taxonomyValid = false;
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) {
            findings.add(new CollateralQualityFindingDto("category", "MISSING", "Collateral Category is missing from CBS feed", "ERROR", true));
        } else {
            List<CollateralTaxonomy> matchingCats = taxonomyRepository.findByCategoryIgnoreCase(collateral.getCategory().trim());
            if (matchingCats.isEmpty()) {
                findings.add(new CollateralQualityFindingDto("category", "INVALID", "Collateral Category '" + collateral.getCategory() + "' does not match CBAIMS approved taxonomy", "ERROR", true));
            } else {
                taxonomyValid = true;
                if (collateral.getType() == null || collateral.getType().isBlank()) {
                    findings.add(new CollateralQualityFindingDto("type", "MISSING", "Collateral Type is missing from classification", "WARNING", false));
                }
            }
        }

        // 2. Organizational Assignment (Section 11)
        if (collateral.getBranch() == null || collateral.getBranch().isBlank()) {
            findings.add(new CollateralQualityFindingDto("branch", "MISSING", "Branch assignment is missing", "ERROR", true));
        } else {
            Optional<Branch> brOpt = branchRepository.findFirstByCodeIgnoreCase(collateral.getBranch().trim())
                    .or(() -> branchRepository.findFirstByNameIgnoreCase(collateral.getBranch().trim()));
            if (brOpt.isEmpty()) {
                findings.add(new CollateralQualityFindingDto("branch", "INVALID", "Branch '" + collateral.getBranch() + "' is not recognized in CBAIMS organizational hierarchy", "ERROR", true));
            } else {
                Branch branch = brOpt.get();
                if (collateral.getDistrict() == null || collateral.getDistrict().isBlank()) {
                    if (branch.getParentDistrictId() != null && !branch.getParentDistrictId().isBlank()) {
                        collateral.setDistrict(branch.getParentDistrictId());
                    } else {
                        findings.add(new CollateralQualityFindingDto("district", "MISSING", "Organizational District not resolved for branch", "WARNING", false));
                    }
                }
            }
        }

        if (collateral.getOwningSegment() == null || collateral.getOwningSegment().isBlank()) {
            findings.add(new CollateralQualityFindingDto("owningSegment", "MISSING", "Business Segment assignment is missing", "ERROR", true));
        } else {
            Optional<BusinessSegment> segOpt = businessSegmentRepository.findFirstByNameIgnoreCase(collateral.getOwningSegment().trim());
            if (segOpt.isEmpty()) {
                findings.add(new CollateralQualityFindingDto("owningSegment", "INVALID", "Owning segment '" + collateral.getOwningSegment() + "' not found in CBAIMS configuration", "ERROR", true));
            }
        }

        if (collateral.getAssignedCro() == null || collateral.getAssignedCro().isBlank()) {
            findings.add(new CollateralQualityFindingDto("assignedCro", "MISSING", "CRO is not assigned to this imported collateral", "WARNING", false));
        }

        // 3. Ownership Verification (Section 10.1 & 10.2)
        if (collateral.getOwners() == null || collateral.getOwners().isEmpty()) {
            findings.add(new CollateralQualityFindingDto("owners", "MISSING", "Legal ownership record is missing. Owner details must be captured.", "ERROR", true));
        } else {
            boolean hasValidOwner = false;
            for (CollateralOwner owner : collateral.getOwners()) {
                if (owner.getName() != null && !owner.getName().isBlank()) {
                    hasValidOwner = true;
                }
            }
            if (!hasValidOwner) {
                findings.add(new CollateralQualityFindingDto("owners.name", "MISSING", "Legal owner name must be specified", "ERROR", true));
            }

            if ("Third-party-owned".equalsIgnoreCase(collateral.getOwnerType()) || "Third-party".equalsIgnoreCase(collateral.getOwnerType())) {
                boolean hasConsentDoc = false;
                if (collateral.getDocuments() != null) {
                    for (OwnershipDocument doc : collateral.getDocuments()) {
                        String docType = doc.getDocumentType() != null ? doc.getDocumentType().toLowerCase() : "";
                        if (docType.contains("consent") || docType.contains("pledge")) {
                            hasConsentDoc = true;
                            break;
                        }
                    }
                }
                if (!hasConsentDoc) {
                    findings.add(new CollateralQualityFindingDto("thirdParty.consent", "MISSING", "Third-Party Consent and Pledge Agreement document is required", "ERROR", true));
                }
            }

            if ("Joint-owned".equalsIgnoreCase(collateral.getOwnerType()) || "Joint".equalsIgnoreCase(collateral.getOwnerType())) {
                double totalPct = collateral.getOwners().stream()
                        .mapToDouble(CollateralOwner::getOwnershipPercentage)
                        .sum();
                if (Math.abs(totalPct - 100.0) > 0.01) {
                    findings.add(new CollateralQualityFindingDto("jointOwnership.percentage", "INVALID", "Joint ownership percentages must sum to 100% (currently " + totalPct + "%)", "ERROR", true));
                }
            }
        }

        // 4. Asset Specific Identification & Coordinates (Section 10.3 & 10.4)
        String cat = collateral.getCategory() != null ? collateral.getCategory().toLowerCase() : "";
        String type = collateral.getType() != null ? collateral.getType().toLowerCase() : "";

        if (cat.contains("immovable") || cat.contains("building") || type.contains("building") || type.contains("property")) {
            if (collateral.getGpsCoordinates() == null || collateral.getGpsCoordinates().isBlank()) {
                findings.add(new CollateralQualityFindingDto("gpsCoordinates", "MISSING", "Building X/Y GPS Coordinates are required for immovable property", "ERROR", true));
            }
            if ((collateral.getTitleDeedNumber() == null || collateral.getTitleDeedNumber().isBlank()) &&
                (collateral.getPropertyCertNumber() == null || collateral.getPropertyCertNumber().isBlank())) {
                findings.add(new CollateralQualityFindingDto("titleDeedNumber", "MISSING", "Title Deed Number or Property Ownership Certificate is required", "ERROR", true));
            }
            if (collateral.isUnderConstruction()) {
                if (collateral.getConstructionCompletionPct() == null) {
                    findings.add(new CollateralQualityFindingDto("constructionCompletionPct", "MISSING", "Construction Completion Percentage is required for property under construction", "ERROR", true));
                }
            }
        } else if (cat.contains("movable") || type.contains("vehicle")) {
            if ((collateral.getVehiclePlateNumber() == null || collateral.getVehiclePlateNumber().isBlank()) &&
                (collateral.getVehicleChassisNumber() == null || collateral.getVehicleChassisNumber().isBlank())) {
                findings.add(new CollateralQualityFindingDto("vehiclePlateNumber", "MISSING", "Vehicle Plate Number or Chassis Number is required", "ERROR", true));
            }
        } else if (cat.contains("machinery") || type.contains("machinery")) {
            if (collateral.getMachinerySerialNo() == null || collateral.getMachinerySerialNo().isBlank()) {
                findings.add(new CollateralQualityFindingDto("machinerySerialNo", "MISSING", "Machinery Serial Number is required", "WARNING", false));
            }
        }

        // 5. Valuation Information (Section 10.5)
        if (collateral.getValuationAmount() <= 0) {
            findings.add(new CollateralQualityFindingDto("valuationAmount", "MISSING", "Bank-assessed valuation amount is required and must be greater than zero", "ERROR", true));
        }
        if (collateral.getValuationDate() == null || collateral.getValuationDate().isBlank()) {
            findings.add(new CollateralQualityFindingDto("valuationDate", "MISSING", "Valuation Date is missing", "WARNING", false));
        }

        // 6. Mandatory Documents Verification & Exception Handling (Section 13)
        List<MandatoryDocumentRule> applicableRules = validationService.resolveApplicableDocumentRules(
                collateral, mandatoryDocumentRuleRepository.findByActiveTrue());
        List<OwnershipDocument> existingDocs = new ArrayList<>();
        if (collateral.getId() != null) {
            existingDocs.addAll(ownershipDocumentRepository.findByCollateralId(collateral.getId()));
            existingDocs.addAll(ownershipDocumentRepository.findByEntityTypeAndEntityId("Collateral", collateral.getId()));
        }
        if (collateral.getDocuments() != null) {
            existingDocs.addAll(collateral.getDocuments());
        }

        List<CimsException> colExceptions = (collateral.getId() != null)
                ? cimsExceptionRepository.findByCollateralId(collateral.getId())
                : Collections.emptyList();

        for (MandatoryDocumentRule rule : applicableRules) {
            if (rule.isMandatory()) {
                boolean docFound = false;
                for (OwnershipDocument doc : existingDocs) {
                    if (!"Rejected".equalsIgnoreCase(doc.getVerificationStatus()) &&
                        !"Archived".equalsIgnoreCase(doc.getStatus()) &&
                        (validationService.docTypeMatches(rule.getDocumentType(), doc.getType()) ||
                         validationService.docTypeMatches(rule.getDocumentType(), doc.getName()))) {
                        docFound = true;
                        break;
                    }
                }
                if (!docFound) {
                    // Check if an authorized exception exists or is pending approval
                    Optional<CimsException> approvedExc = colExceptions.stream()
                            .filter(e -> e.getFailedRequirement() != null &&
                                    (rule.getDocumentType().equalsIgnoreCase(e.getFailedRequirement().trim()) ||
                                     e.getFailedRequirement().toLowerCase().contains(rule.getDocumentType().toLowerCase()) ||
                                     rule.getDocumentType().toLowerCase().contains(e.getFailedRequirement().toLowerCase())) &&
                                    ("Approved".equalsIgnoreCase(e.getStatus()) || "Resolved".equalsIgnoreCase(e.getStatus()) || "Authorized Exception / Management Override".equalsIgnoreCase(e.getStatus())))
                            .findFirst();

                    Optional<CimsException> pendingExc = colExceptions.stream()
                            .filter(e -> e.getFailedRequirement() != null &&
                                    (rule.getDocumentType().equalsIgnoreCase(e.getFailedRequirement().trim()) ||
                                     e.getFailedRequirement().toLowerCase().contains(rule.getDocumentType().toLowerCase()) ||
                                     rule.getDocumentType().toLowerCase().contains(e.getFailedRequirement().toLowerCase())) &&
                                    ("Pending Exception Approval".equalsIgnoreCase(e.getStatus()) || "Under Review".equalsIgnoreCase(e.getStatus()) || "PENDING".equalsIgnoreCase(e.getStatus())))
                            .findFirst();

                    if (approvedExc.isPresent()) {
                        findings.add(new CollateralQualityFindingDto(
                                "document." + rule.getDocumentType(),
                                "EXCEPTION_APPROVED",
                                "Mandatory Document Missing: " + rule.getDocumentType() + " (Authorized Exception Granted: " + approvedExc.get().getId() + ")",
                                "INFO",
                                false
                        ));
                    } else if (pendingExc.isPresent()) {
                        findings.add(new CollateralQualityFindingDto(
                                "document." + rule.getDocumentType(),
                                "EXCEPTION_PENDING",
                                "Mandatory Document Missing: " + rule.getDocumentType() + " (Exception Request Pending Approval: " + pendingExc.get().getId() + ")",
                                "WARNING",
                                false
                        ));
                    } else {
                        findings.add(new CollateralQualityFindingDto(
                                "document." + rule.getDocumentType(),
                                "MISSING",
                                "Mandatory Document Missing: " + rule.getDocumentType(),
                                "ERROR",
                                true
                        ));
                    }
                }
            }
        }

        return findings;
    }

    /**
     * Computes the overall record-level DataQualityStatus based on evaluation findings.
     */
    public String calculateRecordQualityStatus(Collateral collateral, List<CollateralQualityFindingDto> findings) {
        if (collateral == null) return "BLOCKED";

        // Check if under CRO review
        if ("PENDING_CHECKER".equalsIgnoreCase(collateral.getEnrichmentStatus())) {
            return "UNDER_REVIEW";
        }

        // Check taxonomy issue
        boolean classificationError = findings.stream()
                .anyMatch(f -> "category".equals(f.getFieldName()) && "ERROR".equals(f.getSeverity()));
        if (classificationError) {
            return "CLASSIFICATION_REVIEW";
        }

        // Check organizational issue
        boolean orgError = findings.stream()
                .anyMatch(f -> ("branch".equals(f.getFieldName()) || "owningSegment".equals(f.getFieldName())) && "ERROR".equals(f.getSeverity()));
        if (orgError) {
            return "ORGANIZATIONAL_MAPPING_REQUIRED";
        }

        // Check mandatory errors
        boolean hasMandatoryErrors = findings.stream()
                .anyMatch(f -> f.isMandatory() && ("ERROR".equals(f.getSeverity()) || "MISSING".equals(f.getStatus())));

        if (hasMandatoryErrors) {
            return "INCOMPLETE";
        }

        return "COMPLETE";
    }

    /**
     * Re-evaluates and persists the calculated data quality status for a Collateral.
     */
    @org.springframework.transaction.annotation.Transactional
    public String assessAndPersistQuality(String collateralId) {
        if (collateralId == null) return "BLOCKED";
        Optional<Collateral> colOpt = collateralRepository.findById(collateralId);
        if (colOpt.isEmpty()) return "BLOCKED";
        Collateral col = colOpt.get();
        List<CollateralQualityFindingDto> findings = evaluateDataQuality(col);
        String status = calculateRecordQualityStatus(col, findings);
        col.setDataQualityStatus(status);
        collateralRepository.save(col);
        return status;
    }
}
