package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cltb_acc_coll_link_dtls", schema = "cbs_sim")
public class CbsAccCollLinkDtls {
    @Id
    private String id;

    @Column(name = "account_number", nullable = false)
    private String accountNumber;

    @Column(name = "branch_code", nullable = false)
    private String branchCode = "BRN-001";

    @Column(name = "linkage_type", nullable = false)
    private String linkageType = "Primary";

    @Column(name = "linked_reference_no", nullable = false)
    private String linkedReferenceNo;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "linkage_branch")
    private String linkageBranch = "BRN-001";

    @Column(name = "linkage_currency", nullable = false)
    private String linkageCurrency = "ETB";

    @Column(name = "overall_amount")
    private double overallAmount;

    @Column(name = "collateral_category")
    private String collateralCategory;

    private double haircut = 0;

    @Column(name = "limit_amount")
    private double limitAmount;

    @Column(name = "linked_amount")
    private double linkedAmount;

    @Column(name = "linked_percent_number")
    private double linkedPercentNumber;

    @Column(name = "util_order")
    private int utilOrder = 1;

    @Column(name = "reinstate_order")
    private int reinstateOrder = 1;

    @Column(name = "util_amount")
    private double utilAmount;

    @Column(name = "commitment_product")
    private String commitmentProduct;

    @Column(nullable = false)
    private String status = "Active";

    @Column(name = "taken_over")
    private String takenOver = "N";

    @Column(name = "synced_at")
    private String syncedAt;

    @Column(name = "sync_status")
    private String syncStatus = "Not Synced";

    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public CbsAccCollLinkDtls() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getBranchCode() { return branchCode; }
    public void setBranchCode(String branchCode) { this.branchCode = branchCode; }
    public String getLinkageType() { return linkageType; }
    public void setLinkageType(String linkageType) { this.linkageType = linkageType; }
    public String getLinkedReferenceNo() { return linkedReferenceNo; }
    public void setLinkedReferenceNo(String linkedReferenceNo) { this.linkedReferenceNo = linkedReferenceNo; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getLinkageBranch() { return linkageBranch; }
    public void setLinkageBranch(String linkageBranch) { this.linkageBranch = linkageBranch; }
    public String getLinkageCurrency() { return linkageCurrency; }
    public void setLinkageCurrency(String linkageCurrency) { this.linkageCurrency = linkageCurrency; }
    public double getOverallAmount() { return overallAmount; }
    public void setOverallAmount(double overallAmount) { this.overallAmount = overallAmount; }
    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }
    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }
    public double getLimitAmount() { return limitAmount; }
    public void setLimitAmount(double limitAmount) { this.limitAmount = limitAmount; }
    public double getLinkedAmount() { return linkedAmount; }
    public void setLinkedAmount(double linkedAmount) { this.linkedAmount = linkedAmount; }
    public double getLinkedPercentNumber() { return linkedPercentNumber; }
    public void setLinkedPercentNumber(double linkedPercentNumber) { this.linkedPercentNumber = linkedPercentNumber; }
    public int getUtilOrder() { return utilOrder; }
    public void setUtilOrder(int utilOrder) { this.utilOrder = utilOrder; }
    public int getReinstateOrder() { return reinstateOrder; }
    public void setReinstateOrder(int reinstateOrder) { this.reinstateOrder = reinstateOrder; }
    public double getUtilAmount() { return utilAmount; }
    public void setUtilAmount(double utilAmount) { this.utilAmount = utilAmount; }
    public String getCommitmentProduct() { return commitmentProduct; }
    public void setCommitmentProduct(String commitmentProduct) { this.commitmentProduct = commitmentProduct; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTakenOver() { return takenOver; }
    public void setTakenOver(String takenOver) { this.takenOver = takenOver; }
    public String getSyncedAt() { return syncedAt; }
    public void setSyncedAt(String syncedAt) { this.syncedAt = syncedAt; }
    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
