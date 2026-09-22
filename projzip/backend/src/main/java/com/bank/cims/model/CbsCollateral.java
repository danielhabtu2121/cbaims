package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "collaterals", schema = "cbs_sim")
public class CbsCollateral {
    @Id
    private String id;
    
    @Column(name = "collateral_code", nullable = false, unique = true)
    private String collateralCode;
    
    @Column(name = "customer_cif", nullable = false)
    private String customerCif;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;
    
    @Column(nullable = false)
    private String category;
    
    @Column(nullable = false)
    private String currency = "ETB";
    
    @Column(name = "collateral_value", nullable = false)
    private double collateralValue;
    
    private double haircut = 0;
    
    @Column(name = "limit_contribution")
    private double limitContribution;
    
    @Column(name = "start_date", nullable = false)
    private String startDate;
    
    @Column(name = "review_date")
    private String reviewDate;
    
    @Column(name = "collateral_type", nullable = false)
    private String collateralType = "Borrower-owned";
    
    private boolean tangible = true;
    
    @Column(name = "linked_loan_refs", columnDefinition = "TEXT")
    private String linkedLoanRefs;
    
    @Column(name = "linked_account_no")
    private String linkedAccountNo;
    
    @Column(name = "linkage_type", nullable = false)
    private String linkageType = "Primary";
    
    @Column(name = "business_segment", nullable = false)
    private String businessSegment;
    
    @Column(nullable = false)
    private String branch;
    
    @Column(name = "zip_code")
    private String zipCode;
    
    @Column(name = "synced_at")
    private String syncedAt;
    
    @Column(name = "sync_status")
    private String syncStatus = "Not Synced";
    
    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public CbsCollateral() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }
    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public double getCollateralValue() { return collateralValue; }
    public void setCollateralValue(double collateralValue) { this.collateralValue = collateralValue; }
    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }
    public double getLimitContribution() { return limitContribution; }
    public void setLimitContribution(double limitContribution) { this.limitContribution = limitContribution; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getReviewDate() { return reviewDate; }
    public void setReviewDate(String reviewDate) { this.reviewDate = reviewDate; }
    public String getCollateralType() { return collateralType; }
    public void setCollateralType(String collateralType) { this.collateralType = collateralType; }
    public boolean isTangible() { return tangible; }
    public void setTangible(boolean tangible) { this.tangible = tangible; }
    public String getLinkedLoanRefs() { return linkedLoanRefs; }
    public void setLinkedLoanRefs(String linkedLoanRefs) { this.linkedLoanRefs = linkedLoanRefs; }
    public String getLinkedAccountNo() { return linkedAccountNo; }
    public void setLinkedAccountNo(String linkedAccountNo) { this.linkedAccountNo = linkedAccountNo; }
    public String getLinkageType() { return linkageType; }
    public void setLinkageType(String linkageType) { this.linkageType = linkageType; }
    public String getBusinessSegment() { return businessSegment; }
    public void setBusinessSegment(String businessSegment) { this.businessSegment = businessSegment; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getZipCode() { return zipCode; }
    public void setZipCode(String zipCode) { this.zipCode = zipCode; }
    public String getSyncedAt() { return syncedAt; }
    public void setSyncedAt(String syncedAt) { this.syncedAt = syncedAt; }
    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
