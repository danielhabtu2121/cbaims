package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class InsuranceComplianceDto {

    private boolean insuranceRequired = true;
    private String requiredCoverageType;
    private String collateralCategory;
    private String collateralType;
    private double collateralValue = 0.0;
    private double haircut = 0.0;
    private double netSecurityValue = 0.0;
    private double outstandingExposure = 0.0;
    private double requiredInsuranceAmount = 0.0;
    private double insuredAmount = 0.0;
    private double coveragePercentage = 0.0;
    private double coverageGap = 0.0;
    private double coverageExcess = 0.0;

    /**
     * NOT_REQUIRED, UNINSURED, UNDERINSURED, ADEQUATELY_INSURED, EXCESS_INSURANCE
     */
    private String coverageStatus = "UNINSURED";

    /**
     * VALID, EXPIRED, INSUFFICIENT_TERM, INVALID_RANGE, MISSING_DATES
     */
    private String policyValidityStatus = "VALID";

    /**
     * APPROVED, UNAPPROVED, INACTIVE, RESTRICTED, MISSING
     */
    private String approvedInsurerStatus = "APPROVED";

    /**
     * SATISFIED, MISSING_DOCUMENTS, NOT_REQUIRED
     */
    private String mandatoryDocumentStatus = "SATISFIED";

    /**
     * UNIQUE, DUPLICATE_POLICY_NUMBER, DUPLICATE_ACTIVE_POLICY
     */
    private String duplicateStatus = "UNIQUE";

    /**
     * COMPLIANT, NON_COMPLIANT
     */
    private String overallStatus = "COMPLIANT";

    private List<String> validationErrors = new ArrayList<>();
    private List<String> missingDocuments = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    public InsuranceComplianceDto() {}

    public boolean isInsuranceRequired() { return insuranceRequired; }
    public void setInsuranceRequired(boolean insuranceRequired) { this.insuranceRequired = insuranceRequired; }

    public String getRequiredCoverageType() { return requiredCoverageType; }
    public void setRequiredCoverageType(String requiredCoverageType) { this.requiredCoverageType = requiredCoverageType; }

    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }

    public String getCollateralType() { return collateralType; }
    public void setCollateralType(String collateralType) { this.collateralType = collateralType; }

    public double getCollateralValue() { return collateralValue; }
    public void setCollateralValue(double collateralValue) { this.collateralValue = collateralValue; }

    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }

    public double getNetSecurityValue() { return netSecurityValue; }
    public void setNetSecurityValue(double netSecurityValue) { this.netSecurityValue = netSecurityValue; }

    public double getOutstandingExposure() { return outstandingExposure; }
    public void setOutstandingExposure(double outstandingExposure) { this.outstandingExposure = outstandingExposure; }

    public double getRequiredInsuranceAmount() { return requiredInsuranceAmount; }
    public void setRequiredInsuranceAmount(double requiredInsuranceAmount) { this.requiredInsuranceAmount = requiredInsuranceAmount; }

    public double getInsuredAmount() { return insuredAmount; }
    public void setInsuredAmount(double insuredAmount) { this.insuredAmount = insuredAmount; }

    public double getCoveragePercentage() { return coveragePercentage; }
    public void setCoveragePercentage(double coveragePercentage) { this.coveragePercentage = coveragePercentage; }

    public double getCoverageGap() { return coverageGap; }
    public void setCoverageGap(double coverageGap) { this.coverageGap = coverageGap; }

    public double getCoverageExcess() { return coverageExcess; }
    public void setCoverageExcess(double coverageExcess) { this.coverageExcess = coverageExcess; }

    public String getCoverageStatus() { return coverageStatus; }
    public void setCoverageStatus(String coverageStatus) { this.coverageStatus = coverageStatus; }

    public String getPolicyValidityStatus() { return policyValidityStatus; }
    public void setPolicyValidityStatus(String policyValidityStatus) { this.policyValidityStatus = policyValidityStatus; }

    public String getApprovedInsurerStatus() { return approvedInsurerStatus; }
    public void setApprovedInsurerStatus(String approvedInsurerStatus) { this.approvedInsurerStatus = approvedInsurerStatus; }

    public String getMandatoryDocumentStatus() { return mandatoryDocumentStatus; }
    public void setMandatoryDocumentStatus(String mandatoryDocumentStatus) { this.mandatoryDocumentStatus = mandatoryDocumentStatus; }

    public String getDuplicateStatus() { return duplicateStatus; }
    public void setDuplicateStatus(String duplicateStatus) { this.duplicateStatus = duplicateStatus; }

    public String getOverallStatus() { return overallStatus; }
    public void setOverallStatus(String overallStatus) { this.overallStatus = overallStatus; }
    public boolean isOverallCompliant() { return "COMPLIANT".equalsIgnoreCase(overallStatus); }

    public List<String> getValidationErrors() { return validationErrors; }
    public void setValidationErrors(List<String> validationErrors) { this.validationErrors = validationErrors; }

    public List<String> getMissingDocuments() { return missingDocuments; }
    public void setMissingDocuments(List<String> missingDocuments) { this.missingDocuments = missingDocuments; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
}
