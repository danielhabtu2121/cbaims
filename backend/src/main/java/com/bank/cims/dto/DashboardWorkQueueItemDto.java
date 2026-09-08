package com.bank.cims.dto;

import java.math.BigDecimal;

public class DashboardWorkQueueItemDto {
    private String id;
    private String priority; // Critical, High, Medium, Low
    private String category; // Expired Policy, Expiring Soon, Uninsured Collateral, Underinsured, Missing Document, Returned Task, Exception
    private String customerName;
    private String customerCif;
    private String facilityRef;
    private String collateralCode;
    private String policyNumber;
    private String issueDescription;
    private int daysRemainingOrOverdue;
    private String requiredAction;
    private String status;
    private String assignedOfficer;
    private String branch;
    private String segment;
    private BigDecimal exposureAmount;
    private BigDecimal gapAmount;
    private String targetModule;
    private String targetEntityId;

    public DashboardWorkQueueItemDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }
    public String getFacilityRef() { return facilityRef; }
    public void setFacilityRef(String facilityRef) { this.facilityRef = facilityRef; }
    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }
    public String getPolicyNumber() { return policyNumber; }
    public void setPolicyNumber(String policyNumber) { this.policyNumber = policyNumber; }
    public String getIssueDescription() { return issueDescription; }
    public void setIssueDescription(String issueDescription) { this.issueDescription = issueDescription; }
    public int getDaysRemainingOrOverdue() { return daysRemainingOrOverdue; }
    public void setDaysRemainingOrOverdue(int daysRemainingOrOverdue) { this.daysRemainingOrOverdue = daysRemainingOrOverdue; }
    public String getRequiredAction() { return requiredAction; }
    public void setRequiredAction(String requiredAction) { this.requiredAction = requiredAction; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAssignedOfficer() { return assignedOfficer; }
    public void setAssignedOfficer(String assignedOfficer) { this.assignedOfficer = assignedOfficer; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    public BigDecimal getExposureAmount() { return exposureAmount; }
    public void setExposureAmount(BigDecimal exposureAmount) { this.exposureAmount = exposureAmount; }
    public BigDecimal getGapAmount() { return gapAmount; }
    public void setGapAmount(BigDecimal gapAmount) { this.gapAmount = gapAmount; }
    public String getTargetModule() { return targetModule; }
    public void setTargetModule(String targetModule) { this.targetModule = targetModule; }
    public String getTargetEntityId() { return targetEntityId; }
    public void setTargetEntityId(String targetEntityId) { this.targetEntityId = targetEntityId; }
}
