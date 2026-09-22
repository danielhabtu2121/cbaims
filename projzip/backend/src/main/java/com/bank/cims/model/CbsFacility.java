package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "facilities", schema = "cbs_sim")
public class CbsFacility {
    @Id
    private String id;
    
    @Column(name = "line_code", nullable = false, unique = true)
    private String lineCode;
    
    @Column(name = "customer_cif", nullable = false)
    private String customerCif;
    
    @Column(name = "loan_ref_no", nullable = false, unique = true)
    private String loanRefNo;
    
    @Column(name = "facility_type", nullable = false)
    private String facilityType;
    
    @Column(name = "line_currency", nullable = false)
    private String lineCurrency = "ETB";
    
    @Column(name = "revolving_line")
    private boolean revolvingLine = false;
    
    @Column(name = "line_start_date", nullable = false)
    private String lineStartDate;
    
    @Column(name = "line_expiry_date", nullable = false)
    private String lineExpiryDate;
    
    @Column(name = "approved_limit", nullable = false)
    private double approvedLimit;
    
    @Column(name = "available_amount", nullable = false)
    private double availableAmount;
    
    @Column(name = "outstanding_amount", nullable = false)
    private double outstandingAmount;
    
    @Column(name = "collateral_contribution")
    private double collateralContribution = 0;
    
    @Column(name = "collateral_pct")
    private double collateralPct = 0;
    
    @Column(name = "business_segment", nullable = false)
    private String businessSegment;
    
    @Column(nullable = false)
    private String branch;
    
    @Column(name = "relationship_manager")
    private String relationshipManager;
    
    @Column(name = "limit_status", nullable = false)
    private String limitStatus = "Active";
    
    @Column(name = "next_review_date")
    private String nextReviewDate;
    
    @Column(name = "synced_at")
    private String syncedAt;
    
    @Column(name = "sync_status")
    private String syncStatus = "Not Synced";
    
    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public CbsFacility() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getLineCode() { return lineCode; }
    public void setLineCode(String lineCode) { this.lineCode = lineCode; }
    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }
    public String getLoanRefNo() { return loanRefNo; }
    public void setLoanRefNo(String loanRefNo) { this.loanRefNo = loanRefNo; }
    public String getFacilityType() { return facilityType; }
    public void setFacilityType(String facilityType) { this.facilityType = facilityType; }
    public String getLineCurrency() { return lineCurrency; }
    public void setLineCurrency(String lineCurrency) { this.lineCurrency = lineCurrency; }
    public boolean isRevolvingLine() { return revolvingLine; }
    public void setRevolvingLine(boolean revolvingLine) { this.revolvingLine = revolvingLine; }
    public String getLineStartDate() { return lineStartDate; }
    public void setLineStartDate(String lineStartDate) { this.lineStartDate = lineStartDate; }
    public String getLineExpiryDate() { return lineExpiryDate; }
    public void setLineExpiryDate(String lineExpiryDate) { this.lineExpiryDate = lineExpiryDate; }
    public double getApprovedLimit() { return approvedLimit; }
    public void setApprovedLimit(double approvedLimit) { this.approvedLimit = approvedLimit; }
    public double getAvailableAmount() { return availableAmount; }
    public void setAvailableAmount(double availableAmount) { this.availableAmount = availableAmount; }
    public double getOutstandingAmount() { return outstandingAmount; }
    public void setOutstandingAmount(double outstandingAmount) { this.outstandingAmount = outstandingAmount; }
    public double getCollateralContribution() { return collateralContribution; }
    public void setCollateralContribution(double collateralContribution) { this.collateralContribution = collateralContribution; }
    public double getCollateralPct() { return collateralPct; }
    public void setCollateralPct(double collateralPct) { this.collateralPct = collateralPct; }
    public String getBusinessSegment() { return businessSegment; }
    public void setBusinessSegment(String businessSegment) { this.businessSegment = businessSegment; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getRelationshipManager() { return relationshipManager; }
    public void setRelationshipManager(String relationshipManager) { this.relationshipManager = relationshipManager; }
    public String getLimitStatus() { return limitStatus; }
    public void setLimitStatus(String limitStatus) { this.limitStatus = limitStatus; }
    public String getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(String nextReviewDate) { this.nextReviewDate = nextReviewDate; }
    public String getSyncedAt() { return syncedAt; }
    public void setSyncedAt(String syncedAt) { this.syncedAt = syncedAt; }
    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
