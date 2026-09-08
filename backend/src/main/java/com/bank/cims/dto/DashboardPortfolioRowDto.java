package com.bank.cims.dto;

import java.math.BigDecimal;

public class DashboardPortfolioRowDto {
    private String customerId;
    private String customerName;
    private String cif;
    private String segment;
    private String district;
    private String branch;
    private String rmName;
    private String roName;
    private String facilityId;
    private String facilityRef;
    private String facilityType;
    private BigDecimal outstandingExposure;
    private String collateralId;
    private String collateralCode;
    private String collateralDescription;
    private String collateralCategory;
    private String collateralType;
    private String ownershipType;
    private BigDecimal marketValue;
    private double haircut;
    private BigDecimal netSecurity;
    private BigDecimal allocatedSecurity;
    private BigDecimal insuranceRequired;
    private BigDecimal insuredAmount;
    private BigDecimal insuranceGap;
    private double coveragePct;
    private String policyId;
    private String policyNumber;
    private String insurerName;
    private String policyStatus;
    private String expiryDate;
    private int daysToExpiry;
    private String documentStatus;
    private String workflowStatus;
    private String exceptionStatus;
    private String priority;

    public DashboardPortfolioRowDto() {}

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCif() { return cif; }
    public void setCif(String cif) { this.cif = cif; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getRmName() { return rmName; }
    public void setRmName(String rmName) { this.rmName = rmName; }
    public String getRoName() { return roName; }
    public void setRoName(String roName) { this.roName = roName; }
    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }
    public String getFacilityRef() { return facilityRef; }
    public void setFacilityRef(String facilityRef) { this.facilityRef = facilityRef; }
    public String getFacilityType() { return facilityType; }
    public void setFacilityType(String facilityType) { this.facilityType = facilityType; }
    public BigDecimal getOutstandingExposure() { return outstandingExposure; }
    public void setOutstandingExposure(BigDecimal outstandingExposure) { this.outstandingExposure = outstandingExposure; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }
    public String getCollateralDescription() { return collateralDescription; }
    public void setCollateralDescription(String collateralDescription) { this.collateralDescription = collateralDescription; }
    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }
    public String getCollateralType() { return collateralType; }
    public void setCollateralType(String collateralType) { this.collateralType = collateralType; }
    public String getOwnershipType() { return ownershipType; }
    public void setOwnershipType(String ownershipType) { this.ownershipType = ownershipType; }
    public BigDecimal getMarketValue() { return marketValue; }
    public void setMarketValue(BigDecimal marketValue) { this.marketValue = marketValue; }
    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }
    public BigDecimal getNetSecurity() { return netSecurity; }
    public void setNetSecurity(BigDecimal netSecurity) { this.netSecurity = netSecurity; }
    public BigDecimal getAllocatedSecurity() { return allocatedSecurity; }
    public void setAllocatedSecurity(BigDecimal allocatedSecurity) { this.allocatedSecurity = allocatedSecurity; }
    public BigDecimal getInsuranceRequired() { return insuranceRequired; }
    public void setInsuranceRequired(BigDecimal insuranceRequired) { this.insuranceRequired = insuranceRequired; }
    public BigDecimal getInsuredAmount() { return insuredAmount; }
    public void setInsuredAmount(BigDecimal insuredAmount) { this.insuredAmount = insuredAmount; }
    public BigDecimal getInsuranceGap() { return insuranceGap; }
    public void setInsuranceGap(BigDecimal insuranceGap) { this.insuranceGap = insuranceGap; }
    public double getCoveragePct() { return coveragePct; }
    public void setCoveragePct(double coveragePct) { this.coveragePct = coveragePct; }
    public String getPolicyId() { return policyId; }
    public void setPolicyId(String policyId) { this.policyId = policyId; }
    public String getPolicyNumber() { return policyNumber; }
    public void setPolicyNumber(String policyNumber) { this.policyNumber = policyNumber; }
    public String getInsurerName() { return insurerName; }
    public void setInsurerName(String insurerName) { this.insurerName = insurerName; }
    public String getPolicyStatus() { return policyStatus; }
    public void setPolicyStatus(String policyStatus) { this.policyStatus = policyStatus; }
    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }
    public int getDaysToExpiry() { return daysToExpiry; }
    public void setDaysToExpiry(int daysToExpiry) { this.daysToExpiry = daysToExpiry; }
    public String getDocumentStatus() { return documentStatus; }
    public void setDocumentStatus(String documentStatus) { this.documentStatus = documentStatus; }
    public String getWorkflowStatus() { return workflowStatus; }
    public void setWorkflowStatus(String workflowStatus) { this.workflowStatus = workflowStatus; }
    public String getExceptionStatus() { return exceptionStatus; }
    public void setExceptionStatus(String exceptionStatus) { this.exceptionStatus = exceptionStatus; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
}
