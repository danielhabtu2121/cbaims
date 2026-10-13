package com.bank.cims.dto;

import com.bank.cims.model.*;
import java.util.ArrayList;
import java.util.List;

public class Collateral360Dto {
    private Collateral collateral;
    private Customer customer;
    private List<CollateralOwner> activeOwners = new ArrayList<>();
    private List<CollateralOwner> historicalOwners = new ArrayList<>();
    private List<LinkedFacilityDetailDto> linkedFacilities = new ArrayList<>();
    private double netCollateralValue;
    private double totalAllocatedAmount;
    private double unallocatedAmount;
    private double totalSecuredExposure;
    private double utilizationPercentage;
    private boolean crossCollateralized;
    private List<DocumentChecklistItemDto> documentChecklist = new ArrayList<>();
    private List<AuditLog> auditHistory = new ArrayList<>();
    private List<InsurancePolicy> insurancePolicies = new ArrayList<>();
    private List<WorkflowTask> workflowTasks = new ArrayList<>();

    public Collateral360Dto() {}

    public Collateral getCollateral() { return collateral; }
    public void setCollateral(Collateral collateral) { this.collateral = collateral; }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }

    public List<CollateralOwner> getActiveOwners() { return activeOwners; }
    public void setActiveOwners(List<CollateralOwner> activeOwners) { this.activeOwners = activeOwners; }

    public List<CollateralOwner> getHistoricalOwners() { return historicalOwners; }
    public void setHistoricalOwners(List<CollateralOwner> historicalOwners) { this.historicalOwners = historicalOwners; }

    public List<LinkedFacilityDetailDto> getLinkedFacilities() { return linkedFacilities; }
    public void setLinkedFacilities(List<LinkedFacilityDetailDto> linkedFacilities) { this.linkedFacilities = linkedFacilities; }

    public double getNetCollateralValue() { return netCollateralValue; }
    public void setNetCollateralValue(double netCollateralValue) { this.netCollateralValue = netCollateralValue; }

    public double getTotalAllocatedAmount() { return totalAllocatedAmount; }
    public void setTotalAllocatedAmount(double totalAllocatedAmount) { this.totalAllocatedAmount = totalAllocatedAmount; }

    public double getUnallocatedAmount() { return unallocatedAmount; }
    public void setUnallocatedAmount(double unallocatedAmount) { this.unallocatedAmount = unallocatedAmount; }

    public double getRemainingCollateralCapacity() { return unallocatedAmount; }
    public void setRemainingCollateralCapacity(double remainingCollateralCapacity) { this.unallocatedAmount = remainingCollateralCapacity; }

    public double getTotalSecuredExposure() { return totalSecuredExposure; }
    public void setTotalSecuredExposure(double totalSecuredExposure) { this.totalSecuredExposure = totalSecuredExposure; }

    public double getUtilizationPercentage() { return utilizationPercentage; }
    public void setUtilizationPercentage(double utilizationPercentage) { this.utilizationPercentage = utilizationPercentage; }

    public boolean isCrossCollateralized() { return crossCollateralized; }
    public void setCrossCollateralized(boolean crossCollateralized) { this.crossCollateralized = crossCollateralized; }

    public List<DocumentChecklistItemDto> getDocumentChecklist() { return documentChecklist; }
    public void setDocumentChecklist(List<DocumentChecklistItemDto> documentChecklist) { this.documentChecklist = documentChecklist; }

    public List<AuditLog> getAuditHistory() { return auditHistory; }
    public void setAuditHistory(List<AuditLog> auditHistory) { this.auditHistory = auditHistory; }

    public List<InsurancePolicy> getInsurancePolicies() { return insurancePolicies; }
    public void setInsurancePolicies(List<InsurancePolicy> insurancePolicies) { this.insurancePolicies = insurancePolicies; }

    public List<WorkflowTask> getWorkflowTasks() { return workflowTasks; }
    public void setWorkflowTasks(List<WorkflowTask> workflowTasks) { this.workflowTasks = workflowTasks; }

    // --- Inner DTOs ---

    public static class LinkedFacilityDetailDto {
        private String linkId;
        private String loanAccountId;
        private String loanReference;
        private String lineCode;
        private String facilityType;
        private String customerCif;
        private String customerName;
        private double approvedLimit;
        private double outstandingBalance;
        private double availableAmount;
        private String lineCurrency = "ETB";
        private String loanStatus;
        private String branch;
        private String businessSegment;
        private String relationshipManager;
        private double allocatedAmount;
        private double linkedPercentage;
        private String linkageType;
        private String relationshipStatus;
        private String releaseStatus;
        private String effectiveDate;
        private String endDate;

        public LinkedFacilityDetailDto() {}

        public String getLinkId() { return linkId; }
        public void setLinkId(String linkId) { this.linkId = linkId; }
        public String getLoanAccountId() { return loanAccountId; }
        public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }
        public String getLoanReference() { return loanReference; }
        public void setLoanReference(String loanReference) { this.loanReference = loanReference; }
        public String getLineCode() { return lineCode; }
        public void setLineCode(String lineCode) { this.lineCode = lineCode; }
        public String getFacilityType() { return facilityType; }
        public void setFacilityType(String facilityType) { this.facilityType = facilityType; }
        public String getCustomerCif() { return customerCif; }
        public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }
        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }
        public double getApprovedLimit() { return approvedLimit; }
        public void setApprovedLimit(double approvedLimit) { this.approvedLimit = approvedLimit; }
        public double getOutstandingBalance() { return outstandingBalance; }
        public void setOutstandingBalance(double outstandingBalance) { this.outstandingBalance = outstandingBalance; }
        public double getAvailableAmount() { return availableAmount; }
        public void setAvailableAmount(double availableAmount) { this.availableAmount = availableAmount; }
        public String getLineCurrency() { return lineCurrency; }
        public void setLineCurrency(String lineCurrency) { this.lineCurrency = lineCurrency; }
        public String getLoanStatus() { return loanStatus; }
        public void setLoanStatus(String loanStatus) { this.loanStatus = loanStatus; }
        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }
        public String getBusinessSegment() { return businessSegment; }
        public void setBusinessSegment(String businessSegment) { this.businessSegment = businessSegment; }
        public String getRelationshipManager() { return relationshipManager; }
        public void setRelationshipManager(String relationshipManager) { this.relationshipManager = relationshipManager; }
        public double getAllocatedAmount() { return allocatedAmount; }
        public void setAllocatedAmount(double allocatedAmount) { this.allocatedAmount = allocatedAmount; }
        public double getLinkedPercentage() { return linkedPercentage; }
        public void setLinkedPercentage(double linkedPercentage) { this.linkedPercentage = linkedPercentage; }
        public String getLinkageType() { return linkageType; }
        public void setLinkageType(String linkageType) { this.linkageType = linkageType; }
        public String getRelationshipStatus() { return relationshipStatus; }
        public void setRelationshipStatus(String relationshipStatus) { this.relationshipStatus = relationshipStatus; }
        public String getReleaseStatus() { return releaseStatus; }
        public void setReleaseStatus(String releaseStatus) { this.releaseStatus = releaseStatus; }
        public String getEffectiveDate() { return effectiveDate; }
        public void setEffectiveDate(String effectiveDate) { this.effectiveDate = effectiveDate; }
        public String getEndDate() { return endDate; }
        public void setEndDate(String endDate) { this.endDate = endDate; }
    }

    public static class DocumentChecklistItemDto {
        private String documentType;
        private boolean mandatory;
        private boolean attached;
        private String attachedDocId;
        private String attachedDocName;
        private String verificationStatus;
        private String status; // SATISFIED, MISSING, PENDING_VERIFICATION

        public DocumentChecklistItemDto() {}

        public DocumentChecklistItemDto(String documentType, boolean mandatory, boolean attached, String attachedDocId, String attachedDocName, String verificationStatus, String status) {
            this.documentType = documentType;
            this.mandatory = mandatory;
            this.attached = attached;
            this.attachedDocId = attachedDocId;
            this.attachedDocName = attachedDocName;
            this.verificationStatus = verificationStatus;
            this.status = status;
        }

        public String getDocumentType() { return documentType; }
        public void setDocumentType(String documentType) { this.documentType = documentType; }
        public boolean isMandatory() { return mandatory; }
        public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
        public boolean isAttached() { return attached; }
        public void setAttached(boolean attached) { this.attached = attached; }
        public String getAttachedDocId() { return attachedDocId; }
        public void setAttachedDocId(String attachedDocId) { this.attachedDocId = attachedDocId; }
        public String getAttachedDocName() { return attachedDocName; }
        public void setAttachedDocName(String attachedDocName) { this.attachedDocName = attachedDocName; }
        public String getVerificationStatus() { return verificationStatus; }
        public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }
}
